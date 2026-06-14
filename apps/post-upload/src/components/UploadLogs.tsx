import type { UploadLogEntry } from '@/hooks/usePostUpload';

interface UploadLogsProps {
  logs: UploadLogEntry[];
}

export function UploadLogs({ logs }: UploadLogsProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-base font-semibold text-slate-900">日志 / 结果过程</h2>
      <div className="mt-3 space-y-2 text-sm">
        {logs.length === 0 ? (
          <p className="text-slate-500">尚未开始上传。</p>
        ) : (
          logs.map((log, index) => (
            <p
              key={`${log.level}-${index}`}
              className={
                log.level === 'error'
                  ? 'text-red-700'
                  : log.level === 'success'
                    ? 'text-emerald-700'
                    : 'text-slate-700'
              }
            >
              {log.message}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
