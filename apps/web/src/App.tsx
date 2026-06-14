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

  const { uploading, progress, upload } = useUpload({ onLog: addLog });

  const handleUpload = async (file: File) => {
    addLog(`开始上传: ${file.name} (${formatSize(file.size)})`);
    try {
      await upload(file);
      addLog('上传成功!');
    } catch (err) {
      addLog(`上传失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-5">
      <h1 className="text-2xl font-bold mb-2">阿里云 OSS 上传示例</h1>
      <p className="text-gray-600 mb-6">
        支持分片上传、断点续传。文件直接上传到阿里云 OSS，不经过服务器。
      </p>

      <FileUpload onUpload={handleUpload} disabled={uploading} />

      <UploadProgress percent={progress} />

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