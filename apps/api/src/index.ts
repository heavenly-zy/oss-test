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

  const policy = {
    Version: '1',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'oss:PutObject',
          'oss:PutObjectACL',
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

  const result = await stsClient.assumeRole(
    ROLE_ARN,
    policy,
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

// GET /api/oss-token - 获取 OSS 临时凭证
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
