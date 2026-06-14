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

// 上传结果
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

// 上传进度
export interface UploadProgress {
  percent: number;
  uploaded: number;
  total: number;
}