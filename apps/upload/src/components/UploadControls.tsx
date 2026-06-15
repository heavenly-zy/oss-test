import type { UploadStatus } from '@oss-test/shared';

interface UploadControlsProps {
  status: UploadStatus;
  hasFile: boolean;
  onUpload: () => Promise<void>;
  onCancel: () => Promise<void>;
  onRetry: () => Promise<void>;
  onClear: () => void;
}

export function UploadControls({
  status,
  hasFile,
  onUpload,
  onCancel,
  onRetry,
  onClear,
}: UploadControlsProps) {
  const isBusy = status === 'requestingToken' || status === 'uploading';
  const canStart = hasFile && !isBusy;
  const canCancel = isBusy;
  const canRetry = hasFile && (status === 'error' || status === 'cancelled');
  const canClear = !isBusy;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canStart}
          onClick={onUpload}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          开始上传
        </button>
        <button
          type="button"
          disabled={!canCancel}
          onClick={onCancel}
          className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        >
          取消
        </button>
        <button
          type="button"
          disabled={!canRetry}
          onClick={onRetry}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          重试
        </button>
        <button
          type="button"
          disabled={!canClear}
          onClick={onClear}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          清空
        </button>
      </div>
    </section>
  );
}
