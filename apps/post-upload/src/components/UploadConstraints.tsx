interface UploadConstraintsProps {
  maxSize: string;
}

export function UploadConstraints({ maxSize }: UploadConstraintsProps) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <h2 className="text-base font-semibold">表单直传限制</h2>
      <ul className="mt-2 space-y-1">
        <li>这是 POST Policy / 表单直传示例。</li>
        <li>单文件限制：&lt;= {maxSize}。</li>
        <li>不支持 multipart 分片上传。</li>
        <li>不支持 checkpoint / 断点续传。</li>
        <li>依赖 Bucket 正确配置 CORS。</li>
      </ul>
    </section>
  );
}
