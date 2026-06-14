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

// 断点续传检查点
export interface UploadCheckpoint {
  file: File;
  name: string;
  fileSize: number;
  partSize: number;
  uploadId: string;
  bucket: string;
  key: string;
  loaded?: number;
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