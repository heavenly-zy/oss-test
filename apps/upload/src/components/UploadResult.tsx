import type { S3UploadResult, UploadStatus } from '@oss-test/shared';
import { formatDuration } from '@/utils/format';

interface UploadResultProps {
  status: UploadStatus;
  errorMessage: string | null;
  result: S3UploadResult | null;
}

export function UploadResult({ status, errorMessage, result }: UploadResultProps) {
  if (!result && !errorMessage && status !== 'cancelled') return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">上传结果</h2>

      {result ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <ResultRow label="对象 Key" value={result.objectKey} />
          <ResultRow label="存储桶 Bucket" value={result.bucket} />
          <ResultRow label="地域 Region" value={result.region} />
          <ResultRow label="云厂商" value={result.provider} />
          <ResultRow label="接入端点 Endpoint" value={result.endpoint ?? 'AWS 默认'} />
          <ResultRow label="耗时" value={formatDuration(result.durationMs)} />
          {result.eTag ? <ResultRow label="ETag" value={result.eTag} /> : null}
          {result.objectUrl ? (
            <div className="min-w-0 sm:col-span-2">
              <dt className="font-medium text-slate-500">对象访问地址</dt>
              <dd className="mt-1 break-all rounded-md bg-emerald-50 px-2 py-1 text-sm text-emerald-900">
                <a className="underline underline-offset-2" href={result.objectUrl} target="_blank" rel="noreferrer">
                  {result.objectUrl}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {status === 'cancelled' && !errorMessage ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          上传已取消。
        </p>
      ) : null}
    </section>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-all rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-900">
        {value}
      </dd>
    </div>
  );
}
