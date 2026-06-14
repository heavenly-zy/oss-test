import { PolicyUploadForm, UploadConstraints, UploadLogs, UploadResult } from './components';
import { usePostUpload } from './hooks/usePostUpload';
import { formatBytes } from './utils/format';

const FORM_UPLOAD_LIMIT = 5 * 1024 * 1024 * 1024;

function App() {
  const uploadState = usePostUpload();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">阿里云 OSS POST Policy 表单直传示例</h1>
        <p className="text-slate-600">
          这是独立的表单直传 demo。它只演示 <strong>POST Policy + FormData + browser direct upload</strong>，不使用 ali-oss SDK，不支持 multipart，也不支持断点续传。
        </p>
      </header>

      <UploadConstraints maxSize={formatBytes(FORM_UPLOAD_LIMIT)} />

      <PolicyUploadForm
        uploading={uploadState.uploading}
        onUpload={uploadState.upload}
        onClear={uploadState.clear}
      />

      <UploadResult
        status={uploadState.status}
        errorMessage={uploadState.errorMessage}
        result={uploadState.result}
      />

      <UploadLogs logs={uploadState.logs} />
    </div>
  );
}

export default App;
