import type { UploadStatus, UploadLogEntry } from '@/features/upload/types';
import type { UploadMode, UploadPhase } from '@/libs/s3-upload';

export const STATUS_LABELS: Record<UploadStatus, string> = {
  idle: '待上传',
  uploading: '上传中',
  paused: '已暂停',
  success: '上传成功',
  error: '上传失败',
  cancelled: '已终止',
};

export const PHASE_LABELS: Record<UploadPhase | 'idle', string> = {
  idle: '待开始',
  preparing: '准备分片任务',
  uploading: '上传分片',
  completing: '合成对象',
  done: '已完成',
};

export const MODE_LABELS: Record<UploadMode, string> = {
  simple: '普通上传',
  multipart: '分片上传',
  resume: '断点续传',
};

export const LOG_LEVEL_LABELS: Record<UploadLogEntry['level'], string> = {
  info: '信息',
  success: '成功',
  error: '错误',
};
