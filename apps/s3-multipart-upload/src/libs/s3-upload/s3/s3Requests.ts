import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type Part,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SIGN_URL_MAX_EXPIRE_SECONDS } from '../core/constants';
import { stripEndpointPrefix } from '../core/objectKey';
import type {
  RunMultipartOptions,
  S3MultipartUploadConfig,
  S3StsToken,
  StoredPart,
} from '../core/types';

/**
 * 将 Blob/File 转为 AWS SDK v3 在浏览器端最稳定的字节数组请求体。
 *
 * AWS SDK 的浏览器中间件在签名、校验和或探测请求体长度时，可能会把传入对象
 * 当作 Web ReadableStream 并调用 `getReader()`。直接传 `Blob/File` 或部分运行时
 * 返回的 stream 都可能触发 `readableStream.getReader is not a function`。
 *
 * 这里改为显式读取当前文件或当前分片的 `ArrayBuffer`，再转成 `Uint8Array` 交给 SDK。
 * 对 multipart 场景来说，内存占用最多约为「分片大小 × 并发数」，不会把整个大文件一次性载入内存。
 *
 * @param blob File 或 Blob 分片。
 */
async function toByteBody(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * 从后端获取三字段 STS 临时凭证。
 *
 * 后端接口只负责签发 `securityToken`、`accessKeyId`、`accessKeySecret`，
 * Bucket、Region、Endpoint 等上传目标统一由前端环境变量提供。
 *
 * @param url 后端 STS 接口地址，默认是 `/api/s3-sts-token`。
 */
export async function fetchS3StsToken(url: string): Promise<S3StsToken> {
  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`获取 STS 临时凭证失败，HTTP ${response.status}：${text || response.statusText}`);
  }

  const token = JSON.parse(text) as Partial<S3StsToken>;
  if (!token.securityToken || !token.accessKeyId || !token.accessKeySecret) {
    throw new Error('STS 接口必须返回 securityToken、accessKeyId、accessKeySecret。');
  }

  return token as S3StsToken;
}

/**
 * 使用前端配置和 STS 临时凭证创建 AWS SDK v3 S3Client。
 *
 * @param config 前端 S3 运行时配置。
 * @param token 后端返回的三字段 STS 临时凭证。
 */
export function createS3Client(config: S3MultipartUploadConfig, token: S3StsToken): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: token.accessKeyId,
      secretAccessKey: token.accessKeySecret,
      sessionToken: token.securityToken,
    },
  });
}

/**
 * 执行普通 PutObject 上传。
 *
 * @param client 已初始化的 S3Client。
 * @param config 前端 S3 运行时配置。
 * @param file 浏览器 File 对象。
 * @param key 目标对象 Key。
 * @param signal 用于暂停或终止请求的 AbortSignal。
 */
export async function putObject(
  client: S3Client,
  config: S3MultipartUploadConfig,
  file: File,
  key: string,
  signal: AbortSignal
) {
  const body = await toByteBody(file);

  return client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: file.type || 'application/octet-stream',
      Metadata: {
        originalName: encodeURIComponent(file.name),
      },
    }),
    { abortSignal: signal }
  );
}

/**
 * 创建 multipart 上传任务并返回 UploadId。
 *
 * @param client 已初始化的 S3Client。
 * @param config 前端 S3 运行时配置。
 * @param file 浏览器 File 对象，用于设置 ContentType 和原始文件名元信息。
 * @param key 目标对象 Key。
 * @param signal 用于暂停或终止请求的 AbortSignal。
 */
export async function createMultipartTask(
  client: S3Client,
  config: S3MultipartUploadConfig,
  file: File,
  key: string,
  signal: AbortSignal
): Promise<string> {
  const createResult = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: file.type || 'application/octet-stream',
      Metadata: {
        originalName: encodeURIComponent(file.name),
      },
    }),
    { abortSignal: signal }
  );

  if (!createResult.UploadId) {
    throw new Error('对象存储没有返回 UploadId，无法进行分片上传。');
  }

  return createResult.UploadId;
}

/**
 * 上传指定序号的单个分片。
 *
 * `Blob.slice` 先定位文件区间，再由 `toByteBody` 只读取当前分片字节；
 * 上传成功后必须保存 ETag 和 PartNumber，最终合成对象会用到。
 *
 * @param client 已初始化的 S3Client。
 * @param config 前端 S3 运行时配置。
 * @param options 当前 multipart 任务上下文。
 * @param partNumber 分片序号，从 1 开始。
 * @param signal 用于暂停或终止请求的 AbortSignal。
 */
export async function uploadPart(
  client: S3Client,
  config: S3MultipartUploadConfig,
  options: RunMultipartOptions,
  partNumber: number,
  signal: AbortSignal
): Promise<StoredPart> {
  const start = (partNumber - 1) * options.partSize;
  const end = Math.min(start + options.partSize, options.file.size);
  const chunk = options.file.slice(start, end);
  const body = await toByteBody(chunk);

  const result = await client.send(
    new UploadPartCommand({
      Bucket: config.bucket,
      Key: options.key,
      UploadId: options.uploadId,
      PartNumber: partNumber,
      Body: body,
    }),
    { abortSignal: signal }
  );

  if (!result.ETag) {
    throw new Error(`第 ${partNumber} 个分片上传成功但缺少 ETag，无法用于最终合成。`);
  }

  return {
    ETag: result.ETag,
    PartNumber: partNumber,
    Size: chunk.size,
  };
}

/**
 * 合成 multipart 对象。
 *
 * S3 要求提交按 PartNumber 升序排列的 ETag 列表，否则合成可能失败。
 *
 * @param client 已初始化的 S3Client。
 * @param config 前端 S3 运行时配置。
 * @param options 当前 multipart 任务上下文。
 * @param parts 已完成分片列表。
 * @param signal 用于暂停或终止请求的 AbortSignal。
 */
export async function completeMultipartUpload(
  client: S3Client,
  config: S3MultipartUploadConfig,
  options: RunMultipartOptions,
  parts: StoredPart[],
  signal: AbortSignal
) {
  return client.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket,
      Key: options.key,
      UploadId: options.uploadId,
      MultipartUpload: {
        Parts: parts.map(({ ETag, PartNumber }) => ({ ETag, PartNumber })),
      },
    }),
    { abortSignal: signal }
  );
}

/**
 * 终止 multipart 上传任务。
 *
 * 调用后远端已上传分片会被对象存储清理，不能再用原 UploadId 续传。
 *
 * @param client 已初始化的 S3Client。
 * @param config 前端 S3 运行时配置。
 * @param uploadId 需要终止的 multipart UploadId。
 * @param key UploadId 对应的对象 Key。
 */
export async function abortMultipartUpload(
  client: S3Client,
  config: S3MultipartUploadConfig,
  uploadId: string,
  key: string
): Promise<void> {
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      UploadId: uploadId,
    })
  );
}

/**
 * 查询远端已完成分片列表。
 *
 * 断点续传前必须调用该方法校准远端状态，避免只依赖 localStorage 导致合成缺片。
 *
 * @param client 已初始化的 S3Client。
 * @param config 前端 S3 运行时配置。
 * @param uploadId 需要查询的 multipart UploadId。
 * @param key UploadId 对应的对象 Key。
 */
export async function listUploadedParts(
  client: S3Client,
  config: S3MultipartUploadConfig,
  uploadId: string,
  key: string
): Promise<Part[]> {
  const parts: Part[] = [];
  let marker: string | undefined;

  do {
    const result = await client.send(
      new ListPartsCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: marker,
      })
    );

    parts.push(...(result.Parts ?? []));
    marker = result.IsTruncated ? result.NextPartNumberMarker : undefined;
  } while (marker !== undefined);

  return parts;
}

/**
 * 为已完成对象创建预签名读取地址。
 *
 * @param client 已初始化的 S3Client。
 * @param config 前端 S3 运行时配置。
 * @param key 已完成对象的 Key。
 */
export async function createPresignedReadUrl(
  client: S3Client,
  config: S3MultipartUploadConfig,
  key: string
): Promise<string> {
  const expiresIn = Math.min(config.signUrlExpireTime, SIGN_URL_MAX_EXPIRE_SECONDS);

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: stripEndpointPrefix(key, config.endpoint),
    }),
    { expiresIn }
  );
}
