/** 读取字符串环境变量，自动去掉首尾空白。 */
export function readString(key: keyof ImportMetaEnv): string {
  return import.meta.env[key]?.trim() ?? '';
}

/** 读取可选字符串环境变量，空字符串按 undefined 处理。 */
export function readOptionalString(key: keyof ImportMetaEnv): string | undefined {
  const value = readString(key);
  return value || undefined;
}

/** 读取布尔环境变量，支持 true/yes/on/1。 */
export function readBoolean(key: keyof ImportMetaEnv, fallback: boolean): boolean {
  const value = readOptionalString(key);
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/** 读取正整数环境变量，非法值回退到默认值。 */
export function readInteger(key: keyof ImportMetaEnv, fallback: number): number {
  const value = Number(readOptionalString(key));
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/** 读取 MB 单位配置并转换为字节。 */
export function readMegabytes(key: keyof ImportMetaEnv, fallbackMb: number): number {
  return readInteger(key, fallbackMb) * 1024 * 1024;
}
