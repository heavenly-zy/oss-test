import { formatBytes, formatDateTime } from '@/utils/format';

interface FilePickerProps {
  selectedFile: File | null;
  disabled: boolean;
  onSelect: (file: File | null) => void;
}

export function FilePicker({ selectedFile, disabled, onSelect }: FilePickerProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">文件</h2>
          <p className="mt-1 text-sm text-slate-500">
            {selectedFile ? selectedFile.name : '尚未选择文件'}
          </p>
        </div>
        <label
          className={`inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
        >
          选择文件
          <input
            key={selectedFile ? `${selectedFile.name}-${selectedFile.lastModified}` : 'empty'}
            className="sr-only"
            type="file"
            disabled={disabled}
            onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {selectedFile ? (
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-medium text-slate-500">大小</dt>
            <dd className="mt-1 text-slate-900">{formatBytes(selectedFile.size)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">MIME 类型</dt>
            <dd className="mt-1 break-all text-slate-900">
              {selectedFile.type || 'application/octet-stream'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">最后修改</dt>
            <dd className="mt-1 text-slate-900">{formatDateTime(selectedFile.lastModified)}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
