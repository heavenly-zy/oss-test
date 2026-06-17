import { S3Client } from '@aws-sdk/client-s3';
import EventEmitter from 'eventemitter3';
import pLimit from 'p-limit';
import { COMPLETE_PHASE_WEIGHT, S3_UPLOAD_EVENTS } from './constants';
import { createObjectKey, createPublicUrl } from './objectKey';
import {
  assertCheckpointMatchesFile,
  calculateTotalParts,
  normalizePartSize,
  normalizeRemoteParts,
  sortParts,
  sumUploadedBytes,
  throwIfAborted,
  validateUploadConfig,
} from './partUtils';
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartTask,
  createPresignedReadUrl,
  createS3Client,
  fetchS3StsToken,
  headObject,
  listUploadedParts,
  putObject,
  uploadPart,
} from '../s3/s3Requests';
import type {
  MultipartCheckpoint,
  RunMultipartOptions,
  S3MultipartUploadConfig,
  StoredPart,
  UploadIdEvent,
  UploadPhase,
  UploadProgressEvent,
  UploadResult,
} from './types';

export { S3_UPLOAD_EVENTS } from './constants';
export type {
  MultipartCheckpoint,
  S3MultipartUploadConfig,
  S3StsToken,
  StoredPart,
  UploadIdEvent,
  UploadMode,
  UploadPhase,
  UploadProgressEvent,
  UploadResult,
} from './types';

/**
 * 浏览器端 S3 分片上传管理类。
 *
 * 这里没有使用 `@aws-sdk/lib-storage Upload`，而是直接组合 S3 底层 multipart API。
 * 这样可以持久化 `UploadId` 和已完成分片，实现真正可恢复的断点续传。
 */
export class S3MultipartUpload extends EventEmitter {
  private client: S3Client | null = null;
  private activeAbortController: AbortController | null = null;
  private activeLimit: ReturnType<typeof pLimit> | null = null;
  private activeMultipart: Pick<MultipartCheckpoint, 'key' | 'uploadId'> | null = null;

  /**
   * 创建上传管理实例。
   *
   * @param config 前端运行时 S3 配置，包含 Bucket、Region、Endpoint、分片大小等。
   */
  constructor(private readonly config: S3MultipartUploadConfig) {
    super();
    validateUploadConfig(config);
  }

  /**
   * 根据文件大小判断是否需要启用分片上传。
   *
   * @param file 用户选择的浏览器 File 对象。
   * @returns `true` 表示走 multipart，`false` 表示走 PutObject 普通上传。
   */
  shouldUseMultipart(file: File): boolean {
    return file.size > this.config.multipartThreshold;
  }

  /**
   * 自动选择上传方式。
   *
   * 小文件使用 PutObject，大文件使用 multipart。阈值由
   * `config.multipartThreshold` 控制。
   *
   * @param file 用户选择的浏览器 File 对象。
   */
  async upload(file: File): Promise<UploadResult> {
    return this.shouldUseMultipart(file) ? this.multipartUpload(file) : this.uploadFile(file);
  }

  /**
   * 普通上传。
   *
   * 适合小于分片阈值的文件；该流程不会产生 UploadId，因此不能使用
   * S3 multipart 的断点续传能力。
   *
   * @param file 用户选择的浏览器 File 对象。
   */
  async uploadFile(file: File): Promise<UploadResult> {
    const startedAt = performance.now();
    const key = createObjectKey(this.config.basePath, file);
    const client = await this.getInstance();
    const abortController = this.createActiveAbortController();

    this.emitProgress({
      phase: 'uploading',
      mode: 'simple',
      key,
      percent: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
    });

    const result = await putObject(client, this.config, file, key, abortController.signal);

    this.clearActiveUpload();
    this.emitProgress({
      phase: 'done',
      mode: 'simple',
      key,
      percent: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
    });

    return {
      mode: 'simple',
      bucket: this.config.bucket,
      region: this.config.region,
      key,
      eTag: result.ETag,
      publicUrl: createPublicUrl(this.config.publicBaseUrl, key),
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  /**
   * 首次分片上传。
   *
   * 会先调用 CreateMultipartUpload 获取 UploadId，然后按 PartNumber 上传分片。
   * 每完成一个分片都会派发 checkpoint 事件，供 UI 写入 localStorage。
   *
   * @param file 用户选择的浏览器 File 对象。
   */
  async multipartUpload(file: File): Promise<UploadResult> {
    const key = createObjectKey(this.config.basePath, file);
    const partSize = normalizePartSize(file.size, this.config.partSize);
    const uploadId = await this.prepareMultipartTask(file, key);

    return this.runMultipartUpload({
      mode: 'multipart',
      file,
      key,
      uploadId,
      partSize,
      knownParts: [],
    });
  }

  /**
   * 基于本地断点继续 multipart 上传。
   *
   * 恢复前会调用 ListParts 查询远端已完成分片，并只以远端状态作为续传依据。
   *
   * @param file 重新选择的原始文件，必须与 checkpoint 中的文件信息匹配。
   * @param checkpoint localStorage 中保存的断点信息。
   */
  async resumeMultipartUpload(file: File, checkpoint: MultipartCheckpoint): Promise<UploadResult> {
    assertCheckpointMatchesFile(file, checkpoint);

    const client = await this.getInstance();
    const remoteParts = await listUploadedParts(client, this.config, checkpoint.uploadId, checkpoint.key);
    const knownParts = normalizeRemoteParts(remoteParts);

    this.activeMultipart = {
      key: checkpoint.key,
      uploadId: checkpoint.uploadId,
    };
    this.emitUploadId(checkpoint.uploadId, checkpoint.key);

    return this.runMultipartUpload({
      mode: 'resume',
      file,
      key: checkpoint.key,
      uploadId: checkpoint.uploadId,
      partSize: checkpoint.partSize,
      knownParts,
    });
  }

  /**
   * 暂停当前上传请求。
   *
   * 该方法只中止浏览器请求并清空尚未开始的队列，不会调用 AbortMultipartUpload。
   * 因此远端已完成分片会被保留，后续可以用 UploadId 继续续传。
   */
  async pauseActiveUpload(): Promise<void> {
    this.activeLimit?.clearQueue();
    this.activeAbortController?.abort();
  }

  /**
   * 终止当前分片上传任务。
   *
   * 与暂停不同，该方法会调用 AbortMultipartUpload，远端已上传分片会被对象存储清理，
   * 本地 checkpoint 也应由调用方同步删除。
   */
  async abortActiveMultipartUpload(): Promise<void> {
    const multipart = this.activeMultipart;
    await this.pauseActiveUpload();

    if (multipart) {
      await this.abortMultipartUpload(multipart.uploadId, multipart.key);
    }
  }

  /**
   * 按指定 UploadId 终止远端 multipart 任务。
   *
   * @param uploadId CreateMultipartUpload 返回的上传任务 ID。
   * @param key 上传任务对应的对象 Key。
   */
  async abortMultipartUpload(uploadId: string, key: string): Promise<void> {
    const client = await this.getInstance();
    await abortMultipartUpload(client, this.config, uploadId, key);
  }

  /**
   * 为已完成对象生成预签名读取地址。
   *
   * 这里使用 GetObjectCommand 签名，适合下载或预览对象；如果要授权上传，
   * 应使用 PutObjectCommand 生成上传签名。
   *
   * @param key 已上传对象的 Key。
   */
  async createPresignedReadUrl(key: string): Promise<string> {
    return createPresignedReadUrl(await this.getInstance(), this.config, key);
  }

  /**
   * 查询已完成对象的基础信息。
   *
   * 用于本地完成记录复用前校验对象是否仍存在，以及远端大小是否匹配当前文件。
   *
   * @param key 已完成对象的 Key。
   */
  async getCompletedObjectInfo(key: string): Promise<{ eTag?: string; size?: number }> {
    const result = await headObject(await this.getInstance(), this.config, key);

    return {
      eTag: result.ETag,
      size: result.ContentLength,
    };
  }

  /**
   * 创建可持久化断点对象。
   *
   * @param file 当前上传的原始文件。
   * @param uploadId multipart 上传任务 ID。
   * @param key 对象 Key。
   * @param partSize 本次任务固定分片大小。
   */
  createCheckpoint(
    file: File,
    uploadId: string,
    key: string,
    partSize: number
  ): MultipartCheckpoint {
    return {
      version: 1,
      key,
      uploadId,
      partSize,
      file: {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        type: file.type || 'application/octet-stream',
      },
      updatedAt: Date.now(),
    };
  }

  /**
   * 销毁底层 S3Client。
   *
   * 浏览器端通常不是强制要求，但在 React hook 每次任务结束后释放引用更清晰。
   */
  destroy(): void {
    this.client?.destroy();
    this.client = null;
  }

  /**
   * 创建 multipart 上传任务并派发 UploadId 事件。
   */
  private async prepareMultipartTask(file: File, key: string): Promise<string> {
    const client = await this.getInstance();
    const abortController = this.createActiveAbortController();

    this.emitProgress({
      phase: 'preparing',
      mode: 'multipart',
      key,
      percent: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
    });

    const uploadId = await createMultipartTask(client, this.config, file, key, abortController.signal);

    this.activeMultipart = { key, uploadId };
    this.emitUploadId(uploadId, key);
    return uploadId;
  }

  /**
   * 执行分片上传主流程：跳过已完成分片、并发上传剩余分片、最终合成对象。
   */
  private async runMultipartUpload(options: RunMultipartOptions): Promise<UploadResult> {
    const startedAt = performance.now();
    const totalParts = calculateTotalParts(options.file.size, options.partSize);
    const uploadedParts = new Map<number, StoredPart>(
      options.knownParts.map((part) => [part.PartNumber, part])
    );
    const client = await this.getInstance();
    const abortController = this.createActiveAbortController();
    const limit = pLimit(this.config.concurrency);
    let uploadedBytes = sumUploadedBytes(uploadedParts);
    let completedParts = uploadedParts.size;

    this.activeLimit = limit;
    this.emitCheckpoint(options.file, options.uploadId, options.key, options.partSize);
    this.emitMultipartProgress(options, uploadedBytes, completedParts, totalParts, 'uploading');

    const tasks: Array<Promise<StoredPart>> = [];
    for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
      if (uploadedParts.has(partNumber)) continue;

      tasks.push(
        limit(async () => {
          throwIfAborted(abortController.signal);
          const storedPart = await uploadPart(client, this.config, options, partNumber, abortController.signal);

          uploadedParts.set(partNumber, storedPart);
          uploadedBytes += storedPart.Size;
          completedParts += 1;
          this.emitCheckpoint(options.file, options.uploadId, options.key, options.partSize);
          this.emitMultipartProgress(options, uploadedBytes, completedParts, totalParts, 'uploading');

          return storedPart;
        })
      );
    }

    await Promise.all(tasks);

    const completeParts = sortParts(Array.from(uploadedParts.values()));
    if (completeParts.length !== totalParts) {
      throw new Error(`分片数量不完整，当前 ${completeParts.length}/${totalParts}，不能合成对象。`);
    }

    this.emitMultipartProgress(options, options.file.size, totalParts, totalParts, 'completing');
    const completeResult = await completeMultipartUpload(
      client,
      this.config,
      options,
      completeParts,
      abortController.signal
    );

    this.clearActiveUpload();
    this.emitProgress({
      phase: 'done',
      mode: options.mode,
      key: options.key,
      percent: 100,
      uploadedBytes: options.file.size,
      totalBytes: options.file.size,
      completedParts: totalParts,
      totalParts,
    });

    return {
      mode: options.mode,
      bucket: this.config.bucket,
      region: this.config.region,
      key: options.key,
      uploadId: options.uploadId,
      eTag: completeResult.ETag,
      location: completeResult.Location,
      publicUrl: createPublicUrl(this.config.publicBaseUrl, options.key),
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  /**
   * 懒加载 S3Client，并通过后端三字段 STS 接口获取临时凭证。
   */
  private async getInstance(): Promise<S3Client> {
    if (this.client) return this.client;

    const token = await fetchS3StsToken(this.config.stsTokenUrl);
    this.client = createS3Client(this.config, token);

    return this.client;
  }

  /**
   * 为当前请求创建 AbortController，暂停和终止上传都会使用它中止浏览器请求。
   */
  private createActiveAbortController(): AbortController {
    this.activeAbortController = new AbortController();
    return this.activeAbortController;
  }

  /**
   * 清理当前上传任务的运行时引用。
   */
  private clearActiveUpload(): void {
    this.activeAbortController = null;
    this.activeLimit = null;
    this.activeMultipart = null;
  }

  /**
   * 派发 UploadId 事件，UI 可以据此记录断点上下文。
   */
  private emitUploadId(uploadId: string, key: string): void {
    this.emit(S3_UPLOAD_EVENTS.UPLOAD_ID, { uploadId, key } satisfies UploadIdEvent);
  }

  /**
   * 派发完整 checkpoint，调用方通常会保存到 localStorage。
   */
  private emitCheckpoint(
    file: File,
    uploadId: string,
    key: string,
    partSize: number
  ): void {
    this.emit(
      S3_UPLOAD_EVENTS.CHECKPOINT_UPDATE,
      this.createCheckpoint(file, uploadId, key, partSize)
    );
  }

  /**
   * 计算并派发分片上传进度。
   *
   * 上传分片阶段最多展示到 90%，预留合成阶段的视觉空间，避免合成对象时 UI 卡在 100%。
   */
  private emitMultipartProgress(
    options: RunMultipartOptions,
    uploadedBytes: number,
    completedParts: number,
    totalParts: number,
    phase: Extract<UploadPhase, 'uploading' | 'completing'>
  ): void {
    const uploadPercent = Math.min(uploadedBytes / options.file.size, 1) * (1 - COMPLETE_PHASE_WEIGHT) * 100;
    const percent = phase === 'completing' ? 95 : Math.round(uploadPercent);

    this.emitProgress({
      phase,
      mode: options.mode,
      key: options.key,
      percent,
      uploadedBytes,
      totalBytes: options.file.size,
      completedParts,
      totalParts,
    });
  }

  /**
   * 统一派发上传进度事件。
   */
  private emitProgress(event: UploadProgressEvent): void {
    this.emit(S3_UPLOAD_EVENTS.UPLOAD_PROGRESS, event);
  }
}
