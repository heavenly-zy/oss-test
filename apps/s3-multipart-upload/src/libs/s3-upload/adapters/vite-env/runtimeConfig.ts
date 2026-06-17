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
  readInteger,
  readMegabytes,
  readOptionalString,
} from './envReaders';

/** 前端运行时配置，并携带缺失的必填环境变量列表。 */
export interface RuntimeConfig extends S3MultipartUploadConfig {
  /** 当前缺失的必填前端环境变量名称。 */
  missingKeys: string[];
}

/**
 * 读取 Vite 注入的前端环境变量并转换为上传配置。
 */
export function readRuntimeConfig(): RuntimeConfig {
  return {
    bucket: '',
    region: '',
    endpoint: undefined,
    basePath: DEFAULT_BASE_PATH,
    publicBaseUrl: undefined,
    forcePathStyle: false,
    stsTokenUrl: readOptionalString('VITE_S3_STS_TOKEN_URL') ?? DEFAULT_STS_TOKEN_URL,
    partSize: readMegabytes('VITE_S3_PART_SIZE_MB', DEFAULT_PART_SIZE_MB),
    multipartThreshold: readMegabytes('VITE_S3_MULTIPART_THRESHOLD_MB', DEFAULT_MULTIPART_THRESHOLD_MB),
    concurrency: readInteger('VITE_S3_CONCURRENCY', DEFAULT_CONCURRENCY),
    signUrlExpireTime: readInteger('VITE_S3_SIGN_URL_EXPIRE_SECONDS', DEFAULT_SIGN_URL_EXPIRE_SECONDS),
    missingKeys: ['服务端上传配置'],
  };
}
