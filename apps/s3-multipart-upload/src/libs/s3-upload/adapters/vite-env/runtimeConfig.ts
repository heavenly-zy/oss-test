import type { S3MultipartUploadConfig } from '@/libs/s3-upload';
import {
  DEFAULT_BASE_PATH,
  DEFAULT_CONCURRENCY,
  DEFAULT_MULTIPART_THRESHOLD_MB,
  DEFAULT_PART_SIZE_MB,
  DEFAULT_SIGN_URL_EXPIRE_SECONDS,
  DEFAULT_STS_TOKEN_URL,
} from './constants';
import {
  readBoolean,
  readInteger,
  readMegabytes,
  readOptionalString,
  readString,
} from './envReaders';

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
    basePath: readOptionalString('VITE_S3_BASE_PATH') ?? DEFAULT_BASE_PATH,
    publicBaseUrl: readOptionalString('VITE_S3_PUBLIC_BASE_URL'),
    forcePathStyle: readBoolean('VITE_S3_FORCE_PATH_STYLE', false),
    stsTokenUrl: readOptionalString('VITE_S3_STS_TOKEN_URL') ?? DEFAULT_STS_TOKEN_URL,
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
