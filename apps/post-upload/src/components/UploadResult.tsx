import type { UploadSuccessResult } from '@/hooks/usePostUpload';
import { formatDateTime, formatBytes } from '@/utils/format';

interface UploadResultProps {
  status: 'idle' | 'success' | 'error';
  errorMessage: string | null;
  result: UploadSuccessResult | null;
}

export function UploadResult({ status, errorMessage, result }: UploadResultProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">上传结果</h2>
      {status === 'idle' && <p className="mt-3 text-sm text-slate-500">等待上传。</p>}
      {status === 'error' && errorMessage && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      {status === 'success' && result && (
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p className="text-emerald-700">上传成功，浏览器已直接 POST 到 OSS。</p>
          <p>对象 key：{result.objectKey}</p>
          <p>对象 URL：<a className="text-blue-600 underline" href={result.objectUrl} target="_blank" rel="noreferrer">{result.objectUrl}</a></p>
          <p>OSS Host：{result.host}</p>
          <p>策略到期时间：{formatDateTime(result.policy.expireAt)}</p>
          <p>策略最大大小：{formatBytes(result.policy.maxSize)}</p>
          <p>覆盖保护：{result.policy.fields.xOssForbidOverwrite === 'true' ? '已启用' : '未启用'}</p>
        </div>
      )}
    </section>
  );
}
