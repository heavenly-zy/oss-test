import type { CompletedUploadRecord, UploadResult } from '../core/types';
import { createFileId } from './checkpointStore';

const STORAGE_PREFIX = 's3-multipart-upload:completed:';

/** 从 localStorage 读取当前文件对应的已完成上传记录。 */
export function loadCompletedUpload(file: File): CompletedUploadRecord | null {
  const raw = localStorage.getItem(createStorageKey(file));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CompletedUploadRecord;
  } catch {
    localStorage.removeItem(createStorageKey(file));
    return null;
  }
}

/** 保存当前文件的已完成上传结果，供同浏览器本地复用。 */
export function saveCompletedUpload(file: File, result: UploadResult): void {
  const record: CompletedUploadRecord = {
    version: 1,
    bucket: result.bucket,
    region: result.region,
    key: result.key,
    mode: result.mode,
    eTag: result.eTag,
    location: result.location,
    publicUrl: result.publicUrl,
    file: {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      type: file.type || 'application/octet-stream',
    },
    completedAt: Date.now(),
  };

  localStorage.setItem(createStorageKey(file), JSON.stringify(record));
}

/** 删除当前文件对应的已完成上传记录。 */
export function removeCompletedUpload(file: File): void {
  localStorage.removeItem(createStorageKey(file));
}

/** 生成 localStorage key。 */
function createStorageKey(file: File): string {
  return `${STORAGE_PREFIX}${createFileId(file)}`;
}
