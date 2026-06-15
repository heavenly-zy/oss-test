import {
  FilePicker,
  TokenSummary,
  UploadControls,
  UploadLogs,
  UploadProgress,
  UploadResult,
} from './components';
import { useS3Upload } from './hooks/useS3Upload';

function App() {
  const uploadState = useS3Upload();
  const isBusy =
    uploadState.status === 'requestingToken' || uploadState.status === 'uploading';

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950">
              统一 S3 上传
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              使用 AWS SDK v3 直传到 OSS S3 兼容接口。
            </p>
          </div>
          <span className={statusPillClass(uploadState.status)}>
            {statusLabel(uploadState.status)}
          </span>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-5">
            <FilePicker
              selectedFile={uploadState.selectedFile}
              disabled={isBusy}
              onSelect={uploadState.selectFile}
            />
            <UploadControls
              status={uploadState.status}
              hasFile={Boolean(uploadState.selectedFile)}
              onUpload={uploadState.upload}
              onCancel={uploadState.cancel}
              onRetry={uploadState.retry}
              onClear={uploadState.clear}
            />
            <UploadProgress status={uploadState.status} progress={uploadState.progress} />
            <UploadResult
              status={uploadState.status}
              errorMessage={uploadState.errorMessage}
              result={uploadState.result}
            />
          </div>

          <div className="space-y-5">
            <TokenSummary token={uploadState.token} />
            <UploadLogs logs={uploadState.logs} />
          </div>
        </div>
      </div>
    </main>
  );
}

function statusLabel(status: string): string {
  if (status === 'idle') return '待上传';
  if (status === 'requestingToken') return '获取凭证中';
  if (status === 'uploading') return '上传中';
  if (status === 'success') return '上传成功';
  if (status === 'error') return '上传失败';
  if (status === 'cancelled') return '已取消';
  return status;
}

function statusPillClass(status: string): string {
  const base = 'inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold';
  if (status === 'success') return `${base} bg-emerald-100 text-emerald-800`;
  if (status === 'error') return `${base} bg-rose-100 text-rose-800`;
  if (status === 'cancelled') return `${base} bg-amber-100 text-amber-800`;
  if (status === 'uploading' || status === 'requestingToken') {
    return `${base} bg-sky-100 text-sky-800`;
  }
  return `${base} bg-slate-200 text-slate-700`;
}

export default App;
