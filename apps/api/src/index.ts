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
        ],
        Resource: 'acs:oss:*:*:*',
      },
    ],
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
