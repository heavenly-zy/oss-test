import {
  CheckpointPanel,
  ConfigPanel,
  FilePicker,
  ProgressPanel,
  ResultPanel,
  UploadControls,
  UploadLogs,
} from '@/features/upload/components';
import { useS3MultipartUpload } from '@/features/upload/hooks/useS3MultipartUpload';
import { STATUS_LABELS } from '@/i18n/messages/upload';

function App() {
  const upload = useS3MultipartUpload();
  const busy = upload.status === 'uploading';
  const configReady = upload.config.missingKeys.length === 0;

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950">S3 分片断点续传</h1>
            <p className="mt-1 text-sm text-slate-600">
              使用 AWS SDK v3 底层分片 API，开发环境可通过 OSS S3-compatible Endpoint 模拟 S3。
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase text-slate-700 shadow-sm ring-1 ring-slate-200">
            {STATUS_LABELS[upload.status]}
          </span>
        </header>

        {!configReady ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            缺少前端环境变量：{upload.config.missingKeys.join(', ')}
          </section>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-5">
            <FilePicker file={upload.selectedFile} disabled={busy} onSelect={upload.selectFile} />
            <UploadControls
              status={upload.status}
              hasFile={Boolean(upload.selectedFile)}
              hasCheckpoint={Boolean(upload.checkpoint)}
              hasResult={Boolean(upload.result)}
              configReady={configReady}
              onStart={upload.startNewUpload}
              onResume={upload.resumeUpload}
              onPause={upload.pauseUpload}
              onAbort={upload.abortMultipartUpload}
              onSign={upload.createSignedUrl}
              onClear={upload.clear}
            />
            <ProgressPanel status={upload.status} progress={upload.progress} />
            <ResultPanel
              status={upload.status}
              result={upload.result}
              errorMessage={upload.errorMessage}
            />
          </div>

          <div className="space-y-5">
            <ConfigPanel config={upload.config} />
            <CheckpointPanel checkpoint={upload.checkpoint} />
            <UploadLogs logs={upload.logs} />
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
