import type { S3_UPLOAD_EVENTS } from './constants';

/** 上传模式：普通上传、首次分片上传、基于断点的续传、本地完成记录复用。 */
export type UploadMode = 'simple' | 'multipart' | 'resume' | 'local';

/** 上传阶段，用于 UI 展示当前处于准备、上传、合成还是完成。 */
export type UploadPhase = 'preparing' | 'uploading' | 'completing' | 'done';

/** 上传管理类对外派发的事件名联合类型。 */
export type UploadEventName = (typeof S3_UPLOAD_EVENTS)[keyof typeof S3_UPLOAD_EVENTS];

/** 后端 STS 接口返回的三字段临时凭证，字段名与文章示例保持一致。 */
export interface S3StsToken {
  /** 临时会话 Token，对应 AWS SDK v3 credentials.sessionToken。 */
  securityToken: string;
  /** 临时 AccessKeyId。 */
  accessKeyId: string;
  /** 临时 AccessKeySecret，对应 AWS SDK v3 credentials.secretAccessKey。 */
  accessKeySecret: string;
  expiresAt: number;
}

/** 后端下发的上传目标配置。 */
export interface S3UploadTargetConfig {
  /** S3/OSS Bucket 名称。 */
  bucket: string;
  /** S3/OSS Region。 */
  region: string;
  /** 开发环境 OSS S3-compatible endpoint；生产 AWS S3 可为空。 */
  endpoint?: string;
  /** 对象 Key 的统一前缀。 */
  basePath: string;
  /** 公开读域名或 CDN 域名；没有时上传完成后可生成预签名读取地址。 */
  publicBaseUrl?: string;
  /** 是否强制 path-style 地址，MinIO 等本地 S3 服务常需要开启。 */
  forcePathStyle: boolean;
}

/** 后端 STS 接口返回的上传会话。 */
export interface S3StsSession {
  /** 临时上传凭证。 */
  credentials: S3StsToken;
  /** 本次上传使用的目标配置。 */
  upload: S3UploadTargetConfig;
}

/** 前端运行时上传配置。 */
export interface S3MultipartUploadConfig extends S3UploadTargetConfig {
  /** 获取 STS 临时凭证和上传配置的后端接口地址。 */
  stsTokenUrl: string;
  /** 超过该字节数时启用分片上传。 */
  multipartThreshold: number;
  /** 单个分片大小，单位字节。 */
  partSize: number;
  /** 同时上传的分片数量。 */
  concurrency: number;
  /** 预签名读取 URL 有效期，单位秒。 */
  signUrlExpireTime: number;
}

/** 上传进度事件载荷，上传类通过 UPLOAD_PROGRESS 事件派发。 */
export interface UploadProgressEvent {
  /** 当前上传阶段。 */
  phase: UploadPhase;
  /** 当前上传模式。 */
  mode: UploadMode;
  /** 本次上传的对象 Key。 */
  key: string;
  /** UI 展示百分比，范围 0-100。 */
  percent: number;
  /** 已上传字节数。 */
  uploadedBytes: number;
  /** 文件总字节数。 */
  totalBytes: number;
  /** 已完成分片数，仅分片上传时存在。 */
  completedParts?: number;
  /** 总分片数，仅分片上传时存在。 */
  totalParts?: number;
}

/** 创建分片任务后派发的 UploadId 信息。 */
export interface UploadIdEvent {
  /** 对象存储返回的 multipart UploadId，断点续传必须保存它。 */
  uploadId: string;
  /** UploadId 对应的对象 Key。 */
  key: string;
}

/** 已成功上传的分片信息，最终合成对象时需要按 PartNumber 顺序提交。 */
export interface StoredPart {
  /** 分片上传成功后对象存储返回的 ETag。 */
  ETag: string;
  /** 分片序号，从 1 开始。 */
  PartNumber: number;
  /** 分片字节数，用于恢复进度计算。 */
  Size: number;
}

/** 持久化在 localStorage 中的断点信息。 */
export interface MultipartCheckpoint {
  /** 断点结构版本，后续字段变化时可用于兼容迁移。 */
  version: 1;
  /** 断点对应的对象 Key。 */
  key: string;
  /** 断点续传依赖的 multipart UploadId。 */
  uploadId: string;
  /** 创建上传任务时使用的分片大小，续传时必须保持一致。 */
  partSize: number;
  /** 原始文件元信息，用于判断用户重新选择的文件是否与断点匹配。 */
  file: {
    name: string;
    size: number;
    lastModified: number;
    type: string;
  };
  /** 断点最近更新时间，毫秒时间戳。 */
  updatedAt: number;
}

/** 持久化在 localStorage 中的已完成上传记录，用于同浏览器本地复用。 */
export interface CompletedUploadRecord {
  /** 完成记录结构版本，后续字段变化时可用于兼容迁移。 */
  version: 1;
  /** 完成对象所属 Bucket，用于判断记录是否仍匹配当前配置。 */
  bucket: string;
  /** 完成对象所属 Region，用于判断记录是否仍匹配当前配置。 */
  region: string;
  /** 已完成对象 Key。 */
  key: string;
  /** 原始上传模式。 */
  mode: UploadMode;
  /** 已完成对象 ETag。 */
  eTag?: string;
  /** 对象存储返回的 Location。 */
  location?: string;
  /** 基于 publicBaseUrl 拼出的公开访问地址。 */
  publicUrl?: string;
  /** 原始文件元信息，用于判断本地记录是否属于当前文件。 */
  file: {
    name: string;
    size: number;
    lastModified: number;
    type: string;
  };
  /** 上传完成时间，毫秒时间戳。 */
  completedAt: number;
}

/** 上传完成后的标准结果，供 UI 展示对象地址、ETag 和耗时。 */
export interface UploadResult {
  /** 实际使用的上传模式。 */
  mode: UploadMode;
  /** 目标 Bucket。 */
  bucket: string;
  /** 目标 Region。 */
  region: string;
  /** 对象 Key。 */
  key: string;
  /** 分片上传的 UploadId；普通上传没有该字段。 */
  uploadId?: string;
  /** 对象存储返回的 ETag。 */
  eTag?: string;
  /** 对象存储返回的 Location；不同 S3-compatible 服务可能为空。 */
  location?: string;
  /** 基于 publicBaseUrl 拼出的公开访问地址。 */
  publicUrl?: string;
  /** 通过 GetObjectCommand 生成的预签名读取地址。 */
  signedUrl?: string;
  /** 上传耗时，单位毫秒。 */
  durationMs: number;
}

/** 内部分片上传执行参数。 */
export interface RunMultipartOptions {
  /** 当前分片上传模式。 */
  mode: Extract<UploadMode, 'multipart' | 'resume'>;
  /** 需要上传的浏览器 File 对象。 */
  file: File;
  /** 目标对象 Key。 */
  key: string;
  /** 本次 multipart 上传任务的 UploadId。 */
  uploadId: string;
  /** 本次任务固定使用的分片大小。 */
  partSize: number;
  /** 续传时已完成的分片集合。 */
  knownParts: StoredPart[];
}
