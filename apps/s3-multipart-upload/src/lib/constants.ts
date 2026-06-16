/** S3 Multipart Upload 协议限制：单个对象最多 10,000 个分片。 */
export const MAX_S3_PARTS = 10_000;

/** 除最后一个分片外，S3 要求每个分片至少 5 MiB。 */
export const MIN_PART_SIZE = 5 * 1024 * 1024;

/** 分片上传完成后还需要合成对象，因此预留 10% 进度给 Complete 阶段。 */
export const COMPLETE_PHASE_WEIGHT = 0.1;

/** SigV4 预签名 URL 的最长有效期是 7 天。 */
export const SIGN_URL_MAX_EXPIRE_SECONDS = 7 * 24 * 60 * 60;

/** 上传类对外派发的事件名，UI 通过这些事件同步 UploadId、进度和断点。 */
export const S3_UPLOAD_EVENTS = {
  /** 创建 multipart 任务后派发，载荷包含 UploadId 和对象 Key。 */
  UPLOAD_ID: 'UPLOAD_ID',
  /** 上传进度变化时派发。 */
  UPLOAD_PROGRESS: 'UPLOAD_PROGRESS',
  /** 断点内容变化时派发，通常用于写入 localStorage。 */
  CHECKPOINT_UPDATE: 'CHECKPOINT_UPDATE',
} as const;
