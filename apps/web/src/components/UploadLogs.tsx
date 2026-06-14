interface UploadLogsProps {
  logs: string[];
}

export function UploadLogs({ logs }: UploadLogsProps) {
  if (logs.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-700 mb-2">上传日志</h3>
      <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono max-h-64 overflow-y-auto">
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}