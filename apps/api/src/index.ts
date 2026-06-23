import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import type { Context } from 'hono';
import OSS from 'ali-oss';
const { STS } = OSS;
import type {
  OSSPostPolicyResponse,
  OSSTokenResponse,
  UploadTokenResponse,
} from '@oss-test/shared';
import { createPostPolicy, validatePostPolicyEnv } from './post-policy';
import {
  createUploadToken,
  normalizeUploadQuery,
  UploadTokenError,
  validateUploadTokenEnv,
} from './upload-token';

const app = new Hono();

// CORS
app.use('*', cors());

// 环境变量检查
const ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID!;
const ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET!;
const ROLE_ARN = process.env.ROLE_ARN!;
const DEFAULT_S3_BASE_PATH = 'uploads/';

if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET || !ROLE_ARN) {
  console.error('请在 .env 文件中配置以下环境变量:');
  console.error('  OSS_ACCESS_KEY_ID - 阿里云 AccessKey ID');
  console.error('  OSS_ACCESS_KEY_SECRET - 阿里云 AccessKey Secret');
  console.error('  ROLE_ARN - RAM 角色的 ARN');
  process.exit(1);
}

validatePostPolicyEnv();
validateUploadTokenEnv();

/**
 * 获取 OSS 上传用的临时凭证
 */
async function getOSSToken() {
  const stsClient = new STS({
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
  });

  const result = await stsClient.assumeRole(
    ROLE_ARN,
    createMultipartUploadPolicy(),
    3600,
    `oss-upload-${Date.now()}`
  );

  return {
    accessKeyId: result.credentials.AccessKeyId,
    accessKeySecret: result.credentials.AccessKeySecret,
    stsToken: result.credentials.SecurityToken,
    expiration: result.credentials.Expiration,
  };
}

interface S3UploadConfig {
  bucket: string;
  region: string;
  endpoint: string | null;
  basePath: string;
  publicBaseUrl: string | null;
  forcePathStyle: boolean;
}

class S3UploadConfigError extends Error {
  constructor(public readonly missingFields: string[]) {
    super(`Missing ${missingFields.join(', ')}`);
  }
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface UploadIdentityInput {
  algorithm: 'sha256';
  hash: string;
  size: number;
  bucket: string;
  region: string;
  key: string;
  name: string;
  type: string;
  lastModified: number;
}

interface UploadedVideoFrameReport {
  bucket: string;
  region: string;
  key: string;
  eTag?: string;
}

interface UploadedVideoFrameRecord extends UploadedVideoFrameReport {
  publicUrl?: string;
  url?: string;
  urlKind?: 'public' | 'signed';
}

interface UploadMediaMetadataReport {
  type: 'image' | 'video';
  resolution: {
    width: number;
    height: number;
  };
  firstFrame?: UploadedVideoFrameReport;
}

interface UploadMediaMetadataRecord extends Omit<UploadMediaMetadataReport, 'firstFrame'> {
  firstFrame?: UploadedVideoFrameRecord;
}

interface UploadCompletedReportInput extends UploadIdentityInput {
  eTag?: string;
  location?: string;
  media?: UploadMediaMetadataReport;
}

interface UploadCompletedRecord {
  bucket: string;
  region: string;
  key: string;
  eTag?: string;
  location?: string;
  publicUrl?: string;
  media?: UploadMediaMetadataRecord;
}

interface StoredUploadRecord extends UploadIdentityInput, UploadCompletedRecord {
  status: 'available';
  createdAt: number;
  updatedAt: number;
}

interface ObjectMeta {
  size: number;
  eTag?: string;
}

class S3UploadRequestError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    message: string
  ) {
    super(message);
  }
}

const completedUploads = new Map<string, StoredUploadRecord>();

// Return STS credentials with the upload target used by the S3 multipart demo.
async function getS3StsToken() {
  const uploadConfig = getS3UploadConfig();
  const stsClient = new STS({
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
  });

  const result = await stsClient.assumeRole(
    ROLE_ARN,
    createS3MultipartUploadPolicy(uploadConfig),
    3600,
    `s3-multipart-upload-${Date.now()}`
  );

  return {
    credentials: {
      securityToken: result.credentials.SecurityToken,
      accessKeyId: result.credentials.AccessKeyId,
      accessKeySecret: result.credentials.AccessKeySecret,
      expiresAt: result.credentials.Expiration,
    },
    upload: uploadConfig,
  };
}

function getS3UploadConfig(): S3UploadConfig {
  const bucket = readOptionalEnv('OSS_BUCKET');
  const region = readOptionalEnv('OSS_REGION');
  const endpoint = getS3Endpoint(region);
  const basePath = normalizeBasePath(
    readOptionalEnv('S3_BASE_PATH') ??
      readOptionalEnv('OSS_UPLOAD_DIR') ??
      DEFAULT_S3_BASE_PATH
  );
  const publicBaseUrl = normalizeOptionalUrl(
    readOptionalEnv('S3_PUBLIC_BASE_URL') ?? readOptionalEnv('PUBLIC_BASE_URL')
  );
  const forcePathStyle = readBooleanEnv('S3_FORCE_PATH_STYLE', false);
  const missingFields = [
    !bucket ? 'bucket' : '',
    !region ? 'region' : '',
  ].filter(Boolean);

  if (missingFields.length > 0) {
    throw new S3UploadConfigError(missingFields);
  }

  return {
    bucket: bucket!,
    region: region!,
    endpoint,
    basePath,
    publicBaseUrl,
    forcePathStyle,
  };
}

function getS3Endpoint(region: string | undefined): string | null {
  const configuredEndpoint = normalizeOptionalUrl(process.env.S3_ENDPOINT);
  if (configuredEndpoint) return configuredEndpoint;

  return region ? `https://s3.${region}.aliyuncs.com` : null;
}

function createS3MultipartUploadPolicy(config: S3UploadConfig) {
  return {
    Version: '1',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['oss:ListMultipartUploads'],
        Resource: `acs:oss:*:*:${config.bucket}`,
      },
      {
        Effect: 'Allow',
        Action: [
          'oss:PutObject',
          'oss:PutObjectACL',
          'oss:InitiateMultipartUpload',
          'oss:UploadPart',
          'oss:ListParts',
          'oss:CompleteMultipartUpload',
          'oss:AbortMultipartUpload',
          'oss:GetObject',
        ],
        Resource: `acs:oss:*:*:${config.bucket}/${config.basePath}*`,
      },
    ],
  };
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

function readBooleanEnv(key: string, fallback: boolean): boolean {
  const value = readOptionalEnv(key);
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function normalizeOptionalUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

function normalizeBasePath(value: string): string {
  const normalized = value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized ? `${normalized}/` : '';
}

function createMultipartUploadPolicy() {
  return {
    Version: '1',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'oss:PutObject',
          'oss:PutObjectACL',
          'oss:InitiateMultipartUpload',
          'oss:UploadPart',
          'oss:ListParts',
          'oss:CompleteMultipartUpload',
          'oss:AbortMultipartUpload',
          'oss:GetObject',
          "oss:ListMultipartUploads"
        ],
        Resource: 'acs:oss:*:*:*',
      },
    ],
  };
}

function ok<T>(c: Context, data: T) {
  return c.json({
    code: 0,
    message: 'ok',
    data,
  } satisfies ApiResponse<T>);
}

function requestFailed(c: Context, error: unknown) {
  if (error instanceof S3UploadRequestError) {
    return c.json(
      {
        code: error.status,
        message: error.message,
        data: null,
      } satisfies ApiResponse<null>,
      error.status
    );
  }

  if (error instanceof S3UploadConfigError) {
    return c.json(
      {
        code: 500,
        message: `S3 upload config is incomplete: Missing ${error.missingFields.join(', ')}`,
        data: null,
      } satisfies ApiResponse<null>,
      500
    );
  }

  return c.json(
    {
      code: 500,
      message: error instanceof Error ? error.message : 'Unknown error',
      data: null,
    } satisfies ApiResponse<null>,
    500
  );
}

function normalizeLookupInput(value: unknown): UploadIdentityInput {
  return readUploadIdentity(requirePlainObject(value));
}

function normalizeCompleteInput(value: unknown): UploadCompletedReportInput {
  const input = requirePlainObject(value);
  return {
    ...readUploadIdentity(input),
    eTag: readOptionalString(input, 'eTag'),
    location: readOptionalString(input, 'location'),
    media: readMedia(input.media),
  };
}

function readUploadIdentity(input: Record<string, unknown>): UploadIdentityInput {
  if (input.algorithm !== 'sha256') {
    throw new S3UploadRequestError(400, 'algorithm must be sha256');
  }

  return {
    algorithm: 'sha256',
    hash: readRequiredString(input, 'hash'),
    size: readSafeInteger(input, 'size', 0),
    bucket: readRequiredString(input, 'bucket'),
    region: readRequiredString(input, 'region'),
    key: readRequiredString(input, 'key'),
    name: readRequiredString(input, 'name'),
    type: readString(input, 'type'),
    lastModified: readSafeInteger(input, 'lastModified', 0),
  };
}

function readMedia(value: unknown): UploadMediaMetadataReport | undefined {
  if (value === undefined) return undefined;

  const media = requirePlainObject(value);
  const type = media.type;
  if (type !== 'image' && type !== 'video') {
    throw new S3UploadRequestError(400, 'media.type must be image or video');
  }

  const resolution = requirePlainObject(media.resolution);
  return {
    type,
    resolution: {
      width: readSafeInteger(resolution, 'width', 1),
      height: readSafeInteger(resolution, 'height', 1),
    },
    firstFrame: readVideoFrame(media.firstFrame),
  };
}

function readVideoFrame(value: unknown): UploadedVideoFrameReport | undefined {
  if (value === undefined) return undefined;

  const frame = requirePlainObject(value);
  return {
    bucket: readRequiredString(frame, 'bucket'),
    region: readRequiredString(frame, 'region'),
    key: readRequiredString(frame, 'key'),
    eTag: readOptionalString(frame, 'eTag'),
  };
}

function requirePlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new S3UploadRequestError(400, 'request body must be an object');
  }

  return value as Record<string, unknown>;
}

function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string') {
    throw new S3UploadRequestError(400, `${key} must be a string`);
  }

  return value.trim();
}

function readRequiredString(input: Record<string, unknown>, key: string): string {
  const value = readString(input, key);
  if (!value) {
    throw new S3UploadRequestError(400, `${key} cannot be empty`);
  }

  return value;
}

function readOptionalString(
  input: Record<string, unknown>,
  key: string
): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new S3UploadRequestError(400, `${key} must be a string`);
  }

  return value.trim() || undefined;
}

function readSafeInteger(
  input: Record<string, unknown>,
  key: string,
  min: number
): number {
  const value = input[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    throw new S3UploadRequestError(400, `${key} must be a safe integer >= ${min}`);
  }

  return value;
}

function recordKey(input: UploadIdentityInput): string {
  return JSON.stringify([
    input.algorithm,
    input.hash,
    input.size,
    input.bucket,
    input.region,
    input.key,
  ]);
}

function assertUploadTargetAllowed(target: {
  bucket: string;
  region: string;
  key: string;
}): S3UploadConfig {
  const config = getS3UploadConfig();
  if (!isUploadTargetAllowed(target, config)) {
    throw new S3UploadRequestError(403, 'upload target is not allowed');
  }

  return config;
}

function isUploadTargetAllowed(
  target: { bucket: string; region: string; key: string },
  config: S3UploadConfig
): boolean {
  return (
    target.bucket === config.bucket &&
    target.region === config.region &&
    target.key.startsWith(config.basePath)
  );
}

async function getRemoteObjectMeta(
  config: S3UploadConfig,
  key: string
): Promise<ObjectMeta> {
  const client = new OSS({
    region: config.region,
    bucket: config.bucket,
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
  });

  try {
    const result = await client.getObjectMeta(key);
    const size = Number(readHeader(result.res.headers, 'content-length'));
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error('Object storage did not return a valid content-length');
    }

    return {
      size,
      eTag: readHeader(result.res.headers, 'etag'),
    };
  } catch (error) {
    if (isObjectNotFoundError(error)) {
      throw new S3UploadRequestError(404, 'uploaded object does not exist');
    }

    throw error;
  }
}

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = headers[key] ?? headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function isObjectNotFoundError(error: unknown): boolean {
  const maybeError = error as { status?: number; code?: string } | null;
  return maybeError?.status === 404 || maybeError?.code === 'NoSuchKey';
}

function createPublicUrl(publicBaseUrl: string | null, key: string): string | undefined {
  if (!publicBaseUrl) return undefined;
  return `${publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function toMediaRecord(
  media: UploadMediaMetadataReport | undefined
): Promise<UploadMediaMetadataRecord | undefined> {
  if (!media) return undefined;
  if (!media.firstFrame) return media;

  const frameConfig = assertUploadTargetAllowed(media.firstFrame);
  const frameObject = await getRemoteObjectMeta(frameConfig, media.firstFrame.key);
  const publicUrl = createPublicUrl(frameConfig.publicBaseUrl, media.firstFrame.key);
  const firstFrame: UploadedVideoFrameRecord = {
    ...media.firstFrame,
    eTag: media.firstFrame.eTag ?? frameObject.eTag,
    ...(publicUrl
      ? {
          publicUrl,
          url: publicUrl,
          urlKind: 'public' as const,
        }
      : {}),
  };

  return {
    type: media.type,
    resolution: media.resolution,
    firstFrame,
  };
}

function toCompletedRecord(record: StoredUploadRecord): UploadCompletedRecord {
  return {
    bucket: record.bucket,
    region: record.region,
    key: record.key,
    eTag: record.eTag,
    location: record.location,
    publicUrl: record.publicUrl,
    media: record.media,
  };
}

app.get('/api/oss-token', async (c: Context) => {
  try {
    const token = await getOSSToken();
    const response: OSSTokenResponse = {
      success: true,
      data: token,
    };
    return c.json(response);
  } catch (error) {
    console.error('获取 OSS Token 失败:', error);
    return c.json(
      {
        success: false,
        message: '获取凭证失败',
        error: error instanceof Error ? error.message : '未知错误',
      },
      500
    );
  }
});

app.get('/api/s3-sts-token', async (c: Context) => {
  try {
    return c.json(await getS3StsToken(), 200, {
      'Cache-Control': 'no-store',
    });
  } catch (error) {
    console.error('Get S3 STS token failed:', error);
    if (error instanceof S3UploadConfigError) {
      return c.json(
        {
          message: 'S3 upload config is incomplete',
          error: `Missing ${error.missingFields.join(', ')}`,
        },
        500
      );
    }

    return c.json(
      {
        message: 'Failed to get S3 STS token',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

app.post('/api/s3-upload-lookup', async (c: Context) => {
  try {
    const input = normalizeLookupInput(await c.req.json());
    const config = getS3UploadConfig();

    if (!isUploadTargetAllowed(input, config)) {
      return ok(c, null);
    }

    const record = completedUploads.get(recordKey(input));
    if (!record || record.status !== 'available') {
      return ok(c, null);
    }

    let object: ObjectMeta;
    try {
      object = await getRemoteObjectMeta(config, record.key);
    } catch (error) {
      if (error instanceof S3UploadRequestError && error.status === 404) {
        return ok(c, null);
      }

      throw error;
    }

    if (object.size !== record.size) {
      return ok(c, null);
    }

    return ok(c, toCompletedRecord(record));
  } catch (error) {
    console.error('Lookup S3 upload failed:', error);
    return requestFailed(c, error);
  }
});

app.post('/api/s3-upload-complete', async (c: Context) => {
  try {
    const input = normalizeCompleteInput(await c.req.json());
    const config = assertUploadTargetAllowed(input);
    const object = await getRemoteObjectMeta(config, input.key);

    if (object.size !== input.size) {
      throw new S3UploadRequestError(409, 'uploaded object size mismatch');
    }

    const now = Date.now();
    const key = recordKey(input);
    const existing = completedUploads.get(key);
    const media = await toMediaRecord(input.media);
    const record: StoredUploadRecord = {
      ...input,
      eTag: input.eTag ?? object.eTag ?? existing?.eTag,
      location: input.location ?? existing?.location,
      publicUrl: createPublicUrl(config.publicBaseUrl, input.key),
      media: media ?? existing?.media,
      status: 'available',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    completedUploads.set(key, record);

    return ok(c, toCompletedRecord(record));
  } catch (error) {
    console.error('Complete S3 upload failed:', error);
    return requestFailed(c, error);
  }
});

app.get('/api/upload-token', async (c: Context) => {
  try {
    const query = normalizeUploadQuery({
      fileName: c.req.query('fileName'),
      contentType: c.req.query('contentType'),
      size: c.req.query('size'),
    });
    const token = await createUploadToken(query);
    const response: UploadTokenResponse = {
      success: true,
      data: token,
    };
    return c.json(response);
  } catch (error) {
    console.error('Get upload token failed:', error);
    const isKnownError = error instanceof UploadTokenError;
    const status = isKnownError ? error.status : 500;
    const response: UploadTokenResponse = {
      success: false,
      message: isKnownError ? error.message : 'Failed to get upload token',
      error: isKnownError
        ? error.detail ?? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error',
    };

    if (status === 400) return c.json(response, 400);
    if (status === 413) return c.json(response, 413);
    return c.json(response, 500);
  }
});

app.get('/api/oss-post-policy', async (c: Context) => {
  try {
    const policy = await createPostPolicy();
    const response: OSSPostPolicyResponse = {
      success: true,
      data: policy,
    };
    return c.json(response);
  } catch (error) {
    console.error('获取 OSS POST Policy 失败:', error);
    return c.json(
      {
        success: false,
        message: '获取表单直传签名失败',
        error: error instanceof Error ? error.message : '未知错误',
      },
      500
    );
  }
});

// 健康检查
app.get('/health', (c: Context) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT) || 3000;

console.log(`API 服务已启动: http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
