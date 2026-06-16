import type { RuntimeConfig } from '@/config';
import { formatBytes } from '@/utils/format';

interface ConfigPanelProps {
  config: RuntimeConfig;
}

export function ConfigPanel({ config }: ConfigPanelProps) {
  const rows = [
    ['Bucket', config.bucket || '缺失'],
    ['Region', config.region || '缺失'],
    ['Endpoint', config.endpoint || 'AWS 默认'],
    ['上传前缀', config.basePath || '根目录'],
    ['STS 接口', config.stsTokenUrl],
    ['分片大小', formatBytes(config.partSize)],
    ['分片阈值', formatBytes(config.multipartThreshold)],
    ['并发数', String(config.concurrency)],
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">运行配置</h2>
      <dl className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
            <dd className="mt-1 break-all font-mono text-xs text-slate-950">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
