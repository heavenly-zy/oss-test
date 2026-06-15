import type { UploadToken } from '@oss-test/shared';
import { formatDateTime } from '@/utils/format';

interface TokenSummaryProps {
  token: UploadToken | null;
}

export function TokenSummary({ token }: TokenSummaryProps) {
  if (!token) return null;

  const rows = [
    ['云厂商', token.provider],
    ['存储桶 Bucket', token.bucket],
    ['地域 Region', token.region],
    ['接入端点 Endpoint', token.endpoint ?? 'AWS 默认'],
    ['对象 Key', token.objectKey],
    ['过期时间', formatDateTime(token.expiration)],
    ['AccessKeyId（脱敏）', maskToken(token.accessKeyId)],
    ['Secret 状态', token.secretAccessKey ? '已返回' : '缺失'],
    ['Session Token 状态', token.sessionToken ? '已返回' : '缺失'],
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">上传凭证</h2>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="font-medium text-slate-500">{label}</dt>
            <dd className="mt-1 break-all rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-900">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function maskToken(value: string): string {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
