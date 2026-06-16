import type { ReactNode } from 'react';
import type { UploadStatus } from '@/hooks/useS3MultipartUpload';

interface UploadControlsProps {
  status: UploadStatus;
  hasFile: boolean;
  hasCheckpoint: boolean;
  hasResult: boolean;
  configReady: boolean;
  onStart: () => Promise<void>;
  onResume: () => Promise<void>;
  onPause: () => Promise<void>;
  onAbort: () => Promise<void>;
  onSign: () => Promise<void>;
  onClear: () => void;
}

export function UploadControls({
  status,
  hasFile,
  hasCheckpoint,
  hasResult,
  configReady,
  onStart,
  onResume,
  onPause,
  onAbort,
  onSign,
  onClear,
}: UploadControlsProps) {
  const busy = status === 'uploading';
  const disabledBase = !hasFile || busy || !configReady;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <ActionButton disabled={disabledBase} tone="primary" onClick={onStart}>
          上传
        </ActionButton>
        <ActionButton disabled={disabledBase || !hasCheckpoint} tone="neutral" onClick={onResume}>
          断点续传
        </ActionButton>
        <ActionButton disabled={!busy} tone="warning" onClick={onPause}>
          暂停
        </ActionButton>
        <ActionButton disabled={!hasFile || (!busy && !hasCheckpoint)} tone="danger" onClick={onAbort}>
          终止分片
        </ActionButton>
        <ActionButton disabled={busy || !hasResult} tone="neutral" onClick={onSign}>
          生成读取签名
        </ActionButton>
        <ActionButton disabled={busy} tone="neutral" onClick={onClear}>
          清空
        </ActionButton>
      </div>
    </section>
  );
}

function ActionButton({
  children,
  disabled,
  tone,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  tone: 'primary' | 'neutral' | 'warning' | 'danger';
  onClick: () => void | Promise<void>;
}) {
  const className = {
    primary: 'bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-400',
    neutral: 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
    warning: 'border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:border-slate-200 disabled:text-slate-400',
    danger: 'border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:border-slate-200 disabled:text-slate-400',
  }[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onClick()}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
