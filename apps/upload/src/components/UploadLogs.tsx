import type { UploadLogEntry } from '@oss-test/shared';
import { formatDateTime } from '@/utils/format';

interface UploadLogsProps {
  logs: UploadLogEntry[];
}

const LEVEL_CLASS: Record<UploadLogEntry['level'], string> = {
  info: 'bg-sky-50 text-sky-700',
  success: 'bg-emerald-50 text-emerald-700',
  error: 'bg-rose-50 text-rose-700',
};

const LEVEL_LABEL: Record<UploadLogEntry['level'], string> = {
  info: '信息',
  success: '成功',
  error: '错误',
};

export function UploadLogs({ logs }: UploadLogsProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">日志</h2>
        <span className="text-sm text-slate-500">{logs.length}</span>
      </div>

      {logs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">暂无日志。</p>
      ) : (
        <ol className="mt-4 max-h-80 space-y-2 overflow-auto pr-1">
          {logs.map((log, index) => (
            <li key={`${log.time}-${index}`} className="rounded-lg border border-slate-100 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 font-medium ${LEVEL_CLASS[log.level]}`}>
                  {LEVEL_LABEL[log.level]}
                </span>
                <time className="text-slate-400">{formatDateTime(log.time)}</time>
              </div>
              <p className="mt-2 break-words text-sm text-slate-700">{log.message}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
