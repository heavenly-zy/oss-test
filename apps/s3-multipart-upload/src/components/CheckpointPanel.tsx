import type { MultipartCheckpoint } from '@/lib/types';
import { formatBytes, formatTime } from '@/utils/format';

interface CheckpointPanelProps {
  checkpoint: MultipartCheckpoint | null;
}

export function CheckpointPanel({ checkpoint }: CheckpointPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">本地断点</h2>
      {checkpoint ? (
        <dl className="mt-4 space-y-3 text-sm">
          <Row label="UploadId" value={checkpoint.uploadId} />
          <Row label="对象 Key" value={checkpoint.key} />
          <Row label="已完成分片" value={String(checkpoint.parts.length)} />
          <Row label="分片大小" value={formatBytes(checkpoint.partSize)} />
          <Row label="更新时间" value={formatTime(checkpoint.updatedAt)} />
        </dl>
      ) : (
        <p className="mt-4 text-sm text-slate-500">暂无断点</p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs text-slate-950">{value}</dd>
    </div>
  );
}
