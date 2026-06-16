import type { S3MultipartUploadConfig } from '@/lib/types';

const DEFAULT_PART_SIZE_MB = 5;
const DEFAULT_MULTIPART_THRESHOLD_MB = 100;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_SIGN_URL_EXPIRE_SECONDS = 6 * 24 * 60 * 60;

/** 前端运行时配置，并携带缺失的必填环境变量列表。 */
export interface RuntimeConfig extends S3MultipartUploadConfig {
  /** 当前缺失的必填前端环境变量名称。 */
  missingKeys: string[];
}

/**
 * 读取 Vite 注入的前端环境变量并转换为上传配置。
 *
 * `endpoint` 只从前端环境变量读取：开发环境可填写 OSS S3-compatible endpoint，
 * 生产 AWS S3 可留空走 SDK 默认 endpoint。
 */
export function readRuntimeConfig(): RuntimeConfig {
  const bucket = readString('VITE_S3_BUCKET');
  const region = readString('VITE_S3_REGION');

  return {
    bucket,
    region,
    endpoint: readOptionalString('VITE_S3_ENDPOINT'),
    basePath: readOptionalString('VITE_S3_BASE_PATH') ?? 'uploads/',
    publicBaseUrl: readOptionalString('VITE_S3_PUBLIC_BASE_URL'),
    forcePathStyle: readBoolean('VITE_S3_FORCE_PATH_STYLE', false),
    stsTokenUrl: readOptionalString('VITE_S3_STS_TOKEN_URL') ?? '/api/s3-sts-token',
    partSize: readMegabytes('VITE_S3_PART_SIZE_MB', DEFAULT_PART_SIZE_MB),
    multipartThreshold: readMegabytes('VITE_S3_MULTIPART_THRESHOLD_MB', DEFAULT_MULTIPART_THRESHOLD_MB),
    concurrency: readInteger('VITE_S3_CONCURRENCY', DEFAULT_CONCURRENCY),
    signUrlExpireTime: readInteger('VITE_S3_SIGN_URL_EXPIRE_SECONDS', DEFAULT_SIGN_URL_EXPIRE_SECONDS),
    missingKeys: [
      !bucket ? 'VITE_S3_BUCKET' : '',
      !region ? 'VITE_S3_REGION' : '',
    ].filter(Boolean),
  };
}

/** 读取字符串环境变量，自动去掉首尾空白。 */
function readString(key: keyof ImportMetaEnv): string {
  return import.meta.env[key]?.trim() ?? '';
}

/** 读取可选字符串环境变量，空字符串按 undefined 处理。 */
function readOptionalString(key: keyof ImportMetaEnv): string | undefined {
  const value = readString(key);
  return value || undefined;
}

/** 读取布尔环境变量，支持 true/yes/on/1。 */
function readBoolean(key: keyof ImportMetaEnv, fallback: boolean): boolean {
  const value = readOptionalString(key);
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/** 读取正整数环境变量，非法值回退到默认值。 */
function readInteger(key: keyof ImportMetaEnv, fallback: number): number {
  const value = Number(readOptionalString(key));
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/** 读取 MB 单位配置并转换为字节。 */
function readMegabytes(key: keyof ImportMetaEnv, fallbackMb: number): number {
  return readInteger(key, fallbackMb) * 1024 * 1024;
}
