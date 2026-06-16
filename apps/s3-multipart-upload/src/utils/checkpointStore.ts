import type { MultipartCheckpoint } from '@/lib/types';

const STORAGE_PREFIX = 's3-multipart-upload:checkpoint:';

/**
 * 为浏览器 File 生成稳定 ID。
 *
 * @param file 用户选择的文件。
 */
export function createFileId(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * 从 localStorage 读取当前文件对应的断点。
 *
 * @param file 用户选择的文件。
 */
export function loadCheckpoint(file: File): MultipartCheckpoint | null {
  const raw = localStorage.getItem(createStorageKey(file));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MultipartCheckpoint;
  } catch {
    localStorage.removeItem(createStorageKey(file));
    return null;
  }
}

/**
 * 保存当前 multipart 断点。
 *
 * @param file 用户选择的文件。
 * @param checkpoint 需要持久化的断点信息。
 */
export function saveCheckpoint(file: File, checkpoint: MultipartCheckpoint): void {
  localStorage.setItem(createStorageKey(file), JSON.stringify(checkpoint));
}

/**
 * 删除当前文件对应的本地断点。
 *
 * @param file 用户选择的文件。
 */
export function removeCheckpoint(file: File): void {
  localStorage.removeItem(createStorageKey(file));
}

/** 生成 localStorage key。 */
function createStorageKey(file: File): string {
  return `${STORAGE_PREFIX}${createFileId(file)}`;
}
