interface UploadProgressProps {
  percent: number;
  statusLabel?: string;
}

export function UploadProgress({ percent, statusLabel }: UploadProgressProps) {
  if (percent === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>{statusLabel ?? '上传进度'}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
