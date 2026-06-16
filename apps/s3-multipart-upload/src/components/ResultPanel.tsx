import type { UploadResult } from '@/lib/types';
import type { UploadStatus } from '@/hooks/useS3MultipartUpload';
import { formatDuration } from '@/utils/format';
import { MODE_LABELS } from '@/utils/labels';

interface ResultPanelProps {
  status: UploadStatus;
  result: UploadResult | null;
  errorMessage: string | null;
}

export function ResultPanel({ status, result, errorMessage }: ResultPanelProps) {
  if (!result && !errorMessage && status !== 'cancelled') return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">上传结果</h2>
      {result ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Row label="上传模式" value={MODE_LABELS[result.mode]} />
          <Row label="Bucket" value={result.bucket} />
          <Row label="Region" value={result.region} />
          <Row label="耗时" value={formatDuration(result.durationMs)} />
          <Row label="对象 Key" value={result.key} wide />
          {result.uploadId ? <Row label="UploadId" value={result.uploadId} wide /> : null}
          {result.eTag ? <Row label="ETag" value={result.eTag} wide /> : null}
          {result.location ? <Row label="Location" value={result.location} wide /> : null}
          {result.publicUrl ? <LinkRow label="公开访问地址" value={result.publicUrl} /> : null}
          {result.signedUrl ? <LinkRow label="预签名读取地址" value={result.signedUrl} /> : null}
        </dl>
      ) : null}
      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
      {status === 'cancelled' && !errorMessage ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          分片上传已终止。
        </p>
      ) : null}
    </section>
  );
}

function Row({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-all rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-950">
        {value}
      </dd>
    </div>
  );
}

function LinkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 sm:col-span-2">
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-all rounded-md bg-emerald-50 px-2 py-1 font-mono text-xs text-emerald-900">
        <a href={value} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {value}
        </a>
      </dd>
    </div>
  );
}
