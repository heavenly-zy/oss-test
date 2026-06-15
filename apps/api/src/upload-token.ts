import OSS from 'ali-oss';
import type { UploadToken } from '@oss-test/shared';

const { STS } = OSS;

const DEFAULT_UPLOAD_DIR = 'uploads/';
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 * 1024;
const STS_DURATION_SECONDS = 3600;

interface UploadTokenConfig {
  accessKeyId: string;
  accessKeySecret: string;
  roleArn: string;
  region: string;
  bucket: string;
  uploadDir: string;
  maxSize: number;
  publicBaseUrl?: string;
}

interface UploadTokenQuery {
  fileName: string;
  contentType?: string;
  size?: number;
}

export class UploadTokenError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: string
  ) {
    super(message);
  }
}

export function validateUploadTokenEnv() {
  const required = [
    'OSS_REGION',
    'OSS_BUCKET',
    'OSS_ACCESS_KEY_ID',
    'OSS_ACCESS_KEY_SECRET',
    'ROLE_ARN',
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing upload-token environment variables:');
    for (const key of missing) {
      console.error(`  ${key}`);
    }
    process.exit(1);
  }
}

export function normalizeUploadQuery(input: {
  fileName?: string;
  contentType?: string;
  size?: string;
}): UploadTokenQuery {
  const fileName = input.fileName?.trim();
  if (!fileName) {
    throw new UploadTokenError(400, 'fileName cannot be empty');
  }

  const sizeValue = input.size?.trim();
  const size =
    sizeValue === undefined || sizeValue === ''
      ? undefined
      : Number(sizeValue);

  if (
    size !== undefined &&
    (!Number.isSafeInteger(size) || size < 0)
  ) {
    throw new UploadTokenError(400, 'size must be a valid byte count');
  }

  const contentType = input.contentType?.trim() || undefined;

  return {
    fileName,
    contentType,
    size,
  };
}

export async function createUploadToken(query: UploadTokenQuery): Promise<UploadToken> {
  const config = getConfig();

  if (query.size !== undefined && query.size > config.maxSize) {
    throw new UploadTokenError(
      413,
      'file exceeds upload size limit',
      `Max size is ${config.maxSize} bytes`
    );
  }

  const objectKey = createObjectKey(config.uploadDir, query.fileName);
  const stsClient = new STS({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
  });

  const temporaryCredentials = await stsClient.assumeRole(
    config.roleArn,
    createAssumeRolePolicy(),
    STS_DURATION_SECONDS,
    `oss-s3-upload-${Date.now()}`
  );
  const endpoint = createOssS3Endpoint(config.region);
  const publicFields = createPublicUrlFields(config.publicBaseUrl, objectKey);

  return {
    provider: 'oss',
    accessKeyId: temporaryCredentials.credentials.AccessKeyId,
    secretAccessKey: temporaryCredentials.credentials.AccessKeySecret,
    sessionToken: temporaryCredentials.credentials.SecurityToken,
    expiration: temporaryCredentials.credentials.Expiration,
    bucket: config.bucket,
    region: config.region,
    endpoint,
    objectKey,
    ...publicFields,
  };
}

function getConfig(): UploadTokenConfig {
  validateUploadTokenEnv();

  return {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    roleArn: process.env.ROLE_ARN!,
    region: process.env.OSS_REGION!,
    bucket: process.env.OSS_BUCKET!,
    uploadDir: normalizeUploadDir(process.env.OSS_UPLOAD_DIR),
    maxSize: parsePositiveInteger(process.env.UPLOAD_MAX_SIZE, DEFAULT_MAX_SIZE),
    publicBaseUrl: normalizeOptionalUrl(process.env.PUBLIC_BASE_URL),
  };
}

function normalizeUploadDir(dir: string | undefined): string {
  const trimmed = (dir ?? DEFAULT_UPLOAD_DIR).trim().replace(/^\/+/, '');
  if (!trimmed) return DEFAULT_UPLOAD_DIR;
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeObjectName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

function createObjectKey(prefix: string, fileName: string): string {
  const safeName = sanitizeObjectName(fileName) || 'file';
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return `${prefix}${yyyy}/${mm}/${dd}/${Date.now()}_${safeName}`;
}

function createOssS3Endpoint(region: string): string {
  return `https://s3.${region}.aliyuncs.com`;
}

function normalizeOptionalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, '');
}

function createPublicUrlFields(
  publicBaseUrl: string | undefined,
  objectKey: string
): Pick<UploadToken, 'publicBaseUrl' | 'objectUrl'> {
  if (!publicBaseUrl) return {};
  return {
    publicBaseUrl,
    objectUrl: `${publicBaseUrl}/${objectKey}`,
  };
}

function createAssumeRolePolicy() {
  return {
    Version: '1',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'oss:PutObject',
          'oss:InitiateMultipartUpload',
          'oss:UploadPart',
          'oss:CompleteMultipartUpload',
          'oss:AbortMultipartUpload',
          'oss:GetObject',
        ],
        Resource: 'acs:oss:*:*:*',
      },
    ],
  };
}
