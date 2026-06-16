import { useCallback, useId, useRef } from 'react';
import { formatBytes } from '@/utils/format';

interface FilePickerProps {
  file: File | null;
  disabled: boolean;
  onSelect: (file: File | null) => void;
}

export function FilePicker({ file, disabled, onSelect }: FilePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectFirstFile = useCallback(
    (files: FileList | null) => {
      onSelect(files?.[0] ?? null);
    },
    [onSelect]
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-cyan-500 hover:bg-cyan-50/50"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!disabled) selectFirstFile(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => selectFirstFile(event.currentTarget.files)}
        />
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          选择文件
        </label>
        {file ? (
          <div className="max-w-full text-sm">
            <p className="break-all font-medium text-slate-950">{file.name}</p>
            <p className="mt-1 text-slate-500">{formatBytes(file.size)}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">将文件拖到这里</p>
        )}
      </div>

      {file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            inputRef.current!.value = '';
            onSelect(null);
          }}
          className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          移除文件
        </button>
      ) : null}
    </section>
  );
}
