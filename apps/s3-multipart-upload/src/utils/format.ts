/**
 * 将字节数格式化为更适合 UI 展示的单位。
 *
 * @param bytes 字节数。
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/**
 * 将毫秒耗时格式化为 UI 文案。
 *
 * @param ms 毫秒耗时。
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * 将毫秒时间戳格式化为本地时间。
 *
 * @param value 毫秒时间戳。
 */
export function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString();
}

/**
 * 将未知异常转换为可展示给用户的错误信息。
 *
 * @param error 捕获到的未知异常。
 */
export function toReadableError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '上传请求已被浏览器中止。';
  }

  if (error instanceof Error) return error.message;
  return '未知上传错误。';
}
