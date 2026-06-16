import type { UploadProgressEvent } from '@/lib/types';
import type { UploadStatus } from '@/hooks/useS3MultipartUpload';
import { formatBytes } from '@/utils/format';
import { PHASE_LABELS, STATUS_LABELS } from '@/utils/labels';

interface ProgressPanelProps {
  status: UploadStatus;
  progress: UploadProgressEvent | null;
}

export function ProgressPanel({ status, progress }: ProgressPanelProps) {
  const percent = progress?.percent ?? 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">上传进度</h2>
        <span className={statusClass(status)}>{STATUS_LABELS[status]}</span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-cyan-600 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <Metric label="进度" value={`${percent}%`} />
        <Metric
          label="字节"
          value={`${formatBytes(progress?.uploadedBytes ?? 0)} / ${formatBytes(progress?.totalBytes ?? 0)}`}
        />
        <Metric label="阶段" value={PHASE_LABELS[progress?.phase ?? 'idle']} />
        {progress?.totalParts ? (
          <Metric label="分片" value={`${progress.completedParts ?? 0} / ${progress.totalParts}`} />
        ) : null}
      </dl>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-all font-mono text-sm text-slate-950">{value}</dd>
    </div>
  );
}

function statusClass(status: UploadStatus): string {
  const base = 'rounded-full px-3 py-1 text-xs font-semibold capitalize';
  if (status === 'success') return `${base} bg-emerald-100 text-emerald-800`;
  if (status === 'error') return `${base} bg-rose-100 text-rose-800`;
  if (status === 'paused') return `${base} bg-amber-100 text-amber-800`;
  if (status === 'uploading') return `${base} bg-cyan-100 text-cyan-800`;
  return `${base} bg-slate-100 text-slate-700`;
}
