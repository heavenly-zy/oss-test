import type { UploadProgress as UploadProgressValue, UploadStatus } from '@oss-test/shared';
import { formatBytes } from '@/utils/format';

interface UploadProgressProps {
  status: UploadStatus;
  progress: UploadProgressValue;
}

const STATUS_LABELS: Record<UploadStatus, string> = {
  idle: '待上传',
  requestingToken: '正在获取上传凭证',
  uploading: '正在上传',
  success: '上传完成',
  error: '上传失败',
  cancelled: '已取消',
};

export function UploadProgress({ status, progress }: UploadProgressProps) {
  const shouldShow = progress.total > 0 || status !== 'idle';

  if (!shouldShow) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">{STATUS_LABELS[status]}</span>
        <span className="tabular-nums text-slate-500">{progress.percent}%</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
        <span>已上传 {formatBytes(progress.uploaded)}</span>
        <span>总大小 {formatBytes(progress.total)}</span>
      </div>
    </section>
  );
}
