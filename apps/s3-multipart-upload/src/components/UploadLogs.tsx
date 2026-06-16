import type { UploadLogEntry } from '@/hooks/useS3MultipartUpload';
import { formatTime } from '@/utils/format';
import { LOG_LEVEL_LABELS } from '@/utils/labels';

interface UploadLogsProps {
  logs: UploadLogEntry[];
}

export function UploadLogs({ logs }: UploadLogsProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">上传日志</h2>
      <div className="mt-4 max-h-80 space-y-2 overflow-auto">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">暂无日志</p>
        ) : (
          logs.map((log, index) => (
            <div
              key={`${log.time}-${index}`}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={levelClass(log.level)}>{LOG_LEVEL_LABELS[log.level]}</span>
                <time className="font-mono text-xs text-slate-500">{formatTime(log.time)}</time>
              </div>
              <p className="mt-1 break-words text-slate-700">{log.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function levelClass(level: UploadLogEntry['level']): string {
  const base = 'rounded-full px-2 py-0.5 text-xs font-semibold uppercase';
  if (level === 'success') return `${base} bg-emerald-100 text-emerald-800`;
  if (level === 'error') return `${base} bg-rose-100 text-rose-800`;
  return `${base} bg-cyan-100 text-cyan-800`;
}
