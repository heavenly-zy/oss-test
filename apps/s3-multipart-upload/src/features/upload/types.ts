import type { MultipartCheckpoint, RuntimeConfig, UploadProgressEvent, UploadResult } from '@/libs/s3-upload';

/** 页面级上传状态。 */
export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'paused'
  | 'success'
  | 'error'
  | 'cancelled';

/** 页面日志条目。 */
export interface UploadLogEntry {
  /** 日志级别，用于 UI 着色。 */
  level: 'info' | 'success' | 'error';
  /** 日志正文。 */
  message: string;
  /** 日志产生时间，毫秒时间戳。 */
  time: number;
}

/** 上传 Demo hook 暴露给页面组件的全部状态与动作。 */
export interface UseS3MultipartUploadReturn {
  /** 前端运行时配置。 */
  config: RuntimeConfig;
  /** 当前上传状态。 */
  status: UploadStatus;
  /** 当前选择的文件。 */
  selectedFile: File | null;
  /** 当前文件命中的本地断点。 */
  checkpoint: MultipartCheckpoint | null;
  /** 当前上传进度。 */
  progress: UploadProgressEvent | null;
  /** 上传完成结果。 */
  result: UploadResult | null;
  /** 上传日志列表。 */
  logs: UploadLogEntry[];
  /** 最近一次错误信息。 */
  errorMessage: string | null;
  /** 选择或清空文件。 */
  selectFile: (file: File | null) => void;
  /** 自动选择本地复用、断点续传或新上传。 */
  startUpload: () => Promise<void>;
  /** 忽略本地记录和断点，重新创建上传任务。 */
  forceNewUpload: () => Promise<void>;
  /** 暂停当前上传并保留远端分片。 */
  pauseUpload: () => Promise<void>;
  /** 终止远端 multipart 任务并清理本地断点。 */
  abortMultipartUpload: () => Promise<void>;
  /** 为已完成对象生成预签名读取地址。 */
  createSignedUrl: () => Promise<void>;
  /** 清空页面状态。 */
  clear: () => void;
}

/** 初始进度对象，保证页面首屏展示稳定。 */
export const INITIAL_PROGRESS: UploadProgressEvent = {
  phase: 'preparing',
  mode: 'simple',
  key: '',
  percent: 0,
  uploadedBytes: 0,
  totalBytes: 0,
};
