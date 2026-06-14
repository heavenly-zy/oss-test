import { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { UploadProgress } from './components/UploadProgress';
import { UploadLogs } from './components/UploadLogs';
import { useUpload } from './hooks/useUpload';

function App() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${message}`]);
  };

  const { uploading, progress, resumeStatus, upload } = useUpload({ onLog: addLog });

  const handleUpload = async (file: File) => {
    addLog(`开始上传: ${file.name} (${formatSize(file.size)})`);
    try {
      await upload(file);
      addLog('上传成功!');
    } catch (err) {
      addLog(`上传失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const resumeHint =
    resumeStatus === 'available'
      ? '发现上次未完成的上传，已尝试从断点继续。'
      : resumeStatus === 'resuming'
        ? '正在从上次断点继续上传。'
        : null;

  const progressLabel = resumeStatus === 'resuming' ? '继续上传中' : '上传进度';

  return (
    <div className="max-w-2xl mx-auto py-10 px-5">
      <h1 className="text-2xl font-bold mb-2">阿里云 OSS 上传示例</h1>
      <p className="text-gray-600 mb-2">
        支持分片上传、断点续传。文件直接上传到阿里云 OSS，不经过服务器。
      </p>
      <p className="text-sm text-gray-500 mb-6">
        如需查看 POST Policy / 表单直传独立 demo，请访问{' '}
        <a className="text-blue-600 underline" href="http://localhost:5174" target="_blank" rel="noreferrer">
          http://localhost:5174
        </a>
        。
      </p>

      <FileUpload
        onUpload={handleUpload}
        disabled={uploading}
        resumeHint={resumeHint}
      />

      <UploadProgress percent={progress} statusLabel={progressLabel} />

      <UploadLogs logs={logs} />
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export default App;
