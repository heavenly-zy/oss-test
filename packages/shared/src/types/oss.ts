// OSS 配置
export interface OSSConfig {
  region: string;
  bucket: string;
  endpoint?: string;
}

// OSS 临时凭证
export interface OSSToken {
  accessKeyId: string;
  accessKeySecret: string;
  stsToken: string;
  expiration: string;
}

export interface OSSPostPolicyFields {
  policy: string;
  xOssSignature: string;
  xOssSignatureVersion: 'OSS4-HMAC-SHA256';
  xOssCredential: string;
  xOssDate: string;
  xOssSecurityToken: string;
  successActionStatus: '200';
  xOssForbidOverwrite: 'true' | 'false';
}

export interface OSSPostPolicy {
  host: string;
  dir: string;
  expireAt: string;
  maxSize: number;
  keyPrefix: string;
  fields: OSSPostPolicyFields;
}

// 上传结果
export type CloudProvider = 'oss' | 'aws';

export interface UploadToken {
  provider: CloudProvider;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  bucket: string;
  region: string;
  objectKey: string;
  endpoint?: string;
  publicBaseUrl?: string;
  objectUrl?: string;
}

export interface UploadResult {
  etag: string;
  name: string;
  url: string;
}

export interface UploadFileMeta {
  name: string;
  size: number;
  lastModified: number;
  type?: string;
}

export interface UploadCheckpointData {
  uploadId?: string;
  fileSize?: number;
  partSize?: number;
  doneParts?: Array<{
    number?: number;
    etag?: string;
  }>;
  [key: string]: unknown;
}

export interface PersistedUploadCheckpoint {
  version: 1;
  fileId: string;
  fileMeta: UploadFileMeta;
  objectKey: string;
  bucket: string;
  region: string;
  partSize: number;
  updatedAt: number;
  checkpoint: UploadCheckpointData;
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// OSS Token 响应
export type OSSTokenResponse = ApiResponse<OSSToken>;
export type OSSPostPolicyResponse = ApiResponse<OSSPostPolicy>;
export type UploadTokenResponse = ApiResponse<UploadToken>;

export type UploadStatus =
  | 'idle'
  | 'requestingToken'
  | 'uploading'
  | 'success'
  | 'error'
  | 'cancelled';

export interface UploadLogEntry {
  level: 'info' | 'success' | 'error';
  message: string;
  time: string;
}

export interface S3UploadResult {
  provider: CloudProvider;
  bucket: string;
  region: string;
  objectKey: string;
  endpoint?: string;
  objectUrl?: string;
  eTag?: string;
  location?: string;
  durationMs: number;
}

// 上传进度
export interface UploadProgress {
  percent: number;
  uploaded: number;
  total: number;
}
