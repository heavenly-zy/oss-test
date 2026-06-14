import OSS from 'ali-oss';
import type { OSSPostPolicy } from '@oss-test/shared';

const { STS } = OSS;

const DEFAULT_POST_POLICY_EXPIRE_SECONDS = 300;
const DEFAULT_UPLOAD_DIR = 'post-demo/';
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 * 1024;
const MIN_STS_DURATION_SECONDS = 900;

interface PostPolicyEnv {
  accessKeyId: string;
  accessKeySecret: string;
  roleArn: string;
  region: string;
  bucket: string;
  uploadDir: string;
  expireSeconds: number;
  maxSize: number;
  forbidOverwrite: boolean;
}

function normalizeUploadDir(dir: string | undefined): string {
  const trimmed = (dir ?? DEFAULT_UPLOAD_DIR).trim().replace(/^\/+/, '');
  if (!trimmed) return DEFAULT_UPLOAD_DIR;
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
}

function getConfig(): PostPolicyEnv {
  return {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    roleArn: process.env.ROLE_ARN!,
    region: process.env.OSS_REGION!,
    bucket: process.env.OSS_BUCKET!,
    uploadDir: normalizeUploadDir(process.env.OSS_UPLOAD_DIR),
    expireSeconds: parsePositiveInteger(
      process.env.OSS_POST_POLICY_EXPIRE_SECONDS,
      DEFAULT_POST_POLICY_EXPIRE_SECONDS
    ),
    maxSize: parsePositiveInteger(process.env.OSS_POST_POLICY_MAX_SIZE, DEFAULT_MAX_SIZE),
    forbidOverwrite: parseBoolean(process.env.OSS_FORBID_OVERWRITE, true),
  };
}

export function validatePostPolicyEnv() {
  const required = ['OSS_REGION', 'OSS_BUCKET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('请在 .env 文件中配置以下 POST Policy 相关环境变量:');
    for (const key of missing) {
      console.error(`  ${key}`);
    }
    process.exit(1);
  }
}

export async function createPostPolicy(): Promise<OSSPostPolicy> {
  const config = getConfig();
  const stsClient = new STS({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
  });

  const assumeRolePolicy = {
    Version: '1',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['oss:PutObject'],
        Resource: `acs:oss:*:*:${config.bucket}/${config.uploadDir}*`,
      },
    ],
  };

  const now = new Date();
  const sessionName = `oss-post-${now.getTime()}`;
  const stsDurationSeconds = Math.max(config.expireSeconds, MIN_STS_DURATION_SECONDS);
  const temporaryCredentials = await stsClient.assumeRole(
    config.roleArn,
    assumeRolePolicy,
    stsDurationSeconds,
    sessionName
  );

  const expirationDate = new Date(now.getTime() + config.expireSeconds * 1000);
  const formattedDate = formatDateToUTC(now);
  const standardRegion = config.region.replace(/^oss-/, '');
  const credential = `${temporaryCredentials.credentials.AccessKeyId}/${formattedDate.split('T')[0]}/${standardRegion}/oss/aliyun_v4_request`;
  const forbidOverwrite = config.forbidOverwrite ? 'true' : 'false';

  const policyDocument = {
    expiration: expirationDate.toISOString(),
    conditions: [
      { bucket: config.bucket },
      ['starts-with', '$key', config.uploadDir],
      ['content-length-range', 1, config.maxSize],
      ['eq', '$success_action_status', '200'],
      { 'x-oss-signature-version': 'OSS4-HMAC-SHA256' },
      { 'x-oss-credential': credential },
      { 'x-oss-date': formattedDate },
      { 'x-oss-security-token': temporaryCredentials.credentials.SecurityToken },
      { 'x-oss-forbid-overwrite': forbidOverwrite },
    ],
  };

  const signer = new OSS({
    region: config.region,
    bucket: config.bucket,
    accessKeyId: temporaryCredentials.credentials.AccessKeyId,
    accessKeySecret: temporaryCredentials.credentials.AccessKeySecret,
    stsToken: temporaryCredentials.credentials.SecurityToken,
    authorizationV4: true,
  });

  return {
    host: `https://${config.bucket}.${config.region}.aliyuncs.com`,
    dir: config.uploadDir,
    expireAt: expirationDate.toISOString(),
    maxSize: config.maxSize,
    keyPrefix: config.uploadDir,
    fields: {
      policy: Buffer.from(JSON.stringify(policyDocument), 'utf8').toString('base64'),
      xOssSignature: signer.signPostObjectPolicyV4(policyDocument, now),
      xOssSignatureVersion: 'OSS4-HMAC-SHA256',
      xOssCredential: credential,
      xOssDate: formattedDate,
      xOssSecurityToken: temporaryCredentials.credentials.SecurityToken,
      successActionStatus: '200',
      xOssForbidOverwrite: forbidOverwrite,
    },
  };
}

function formatDateToUTC(date: Date): string {
  return (
    date.getUTCFullYear() +
    padTo2Digits(date.getUTCMonth() + 1) +
    padTo2Digits(date.getUTCDate()) +
    'T' +
    padTo2Digits(date.getUTCHours()) +
    padTo2Digits(date.getUTCMinutes()) +
    padTo2Digits(date.getUTCSeconds()) +
    'Z'
  );
}

function padTo2Digits(value: number): string {
  return value.toString().padStart(2, '0');
}
