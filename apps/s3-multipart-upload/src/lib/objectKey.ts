/**
 * 根据上传前缀、日期和随机 ID 生成对象 Key。
 *
 * 生成格式：`basePath/yyyy/mm/dd/uuid-safeFileName`，方便对象存储侧按日期排查。
 *
 * @param basePath 对象 Key 前缀。
 * @param file 用户选择的文件。
 */
export function createObjectKey(basePath: string, file: File): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const safeName = file.name.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '-');

  return `${normalizeBasePath(basePath)}${yyyy}/${mm}/${dd}/${random}-${safeName || 'file'}`;
}

/**
 * 根据公开域名和对象 Key 拼接访问地址。
 *
 * @param publicBaseUrl 公开读域名或 CDN 域名。
 * @param key 对象 Key。
 */
export function createPublicUrl(publicBaseUrl: string | undefined, key: string): string | undefined {
  if (!publicBaseUrl) return undefined;
  return `${publicBaseUrl.replace(/\/+$/, '')}/${encodeObjectKey(key)}`;
}

/**
 * 对对象 Key 的每个路径段做 URL 编码。
 *
 * @param key 对象 Key。
 */
export function encodeObjectKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

/**
 * 如果传入值是完整 endpoint URL，则去掉 endpoint 前缀，只保留对象 Key。
 *
 * @param key 对象 Key 或完整访问地址。
 * @param endpoint 当前 S3 endpoint。
 */
export function stripEndpointPrefix(key: string, endpoint: string | undefined): string {
  if (!endpoint || !key.startsWith(endpoint)) return key;
  return key.slice(endpoint.length).replace(/^\/+/, '');
}

/** 规范化对象 Key 前缀，保证为空或以 `/` 结尾。 */
function normalizeBasePath(basePath: string): string {
  const normalized = basePath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized ? `${normalized}/` : '';
}
