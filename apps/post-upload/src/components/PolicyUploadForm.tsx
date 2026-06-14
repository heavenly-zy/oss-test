import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { formatBytes } from '@/utils/format';

interface PolicyUploadFormProps {
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
}

export function PolicyUploadForm({
  uploading,
  onUpload,
  onClear,
}: PolicyUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);

  const fileSummary = useMemo(() => {
    if (!file) return '尚未选择文件';
    return `${file.name} (${formatBytes(file.size)})`;
  }, [file]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    await onUpload(file);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">选择文件并表单直传</h2>
      <p className="mt-2 text-sm text-slate-600">
        点击上传时会先请求 <code>/api/oss-post-policy</code>，再由浏览器直接 POST 到 OSS。
      </p>
      <label className="mt-4 block text-sm font-medium text-slate-700">
        文件
        <input
          className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={uploading}
        />
      </label>
      <p className="mt-3 text-sm text-slate-500">{fileSummary}</p>
      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {uploading ? '上传中...' : '开始表单直传'}
        </button>
        <button
          type="button"
          onClick={() => {
            setFile(null);
            onClear();
          }}
          disabled={uploading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          清空结果
        </button>
      </div>
    </form>
  );
}
