import type { CompletedPart, Part } from '@aws-sdk/client-s3';
import { MAX_S3_PARTS, MIN_PART_SIZE } from './constants';
import type { MultipartCheckpoint, S3MultipartUploadConfig, StoredPart } from './types';

/**
 * 校验上传配置是否满足最低运行要求。
 *
 * @param config 前端运行时上传配置。
 */
export function validateUploadConfig(config: S3MultipartUploadConfig): void {
  if (!config.bucket) throw new Error('缺少 VITE_S3_BUCKET。');
  if (!config.region) throw new Error('缺少 VITE_S3_REGION。');
  if (config.partSize < MIN_PART_SIZE) {
    throw new Error('S3 分片大小必须至少为 5 MiB。');
  }
  if (config.concurrency < 1) throw new Error('S3 分片并发数必须至少为 1。');
}

/**
 * 计算最终使用的分片大小。
 *
 * 如果文件极大，会自动放大分片，避免超过 S3 10,000 分片上限。
 *
 * @param fileSize 文件总字节数。
 * @param preferredPartSize 环境变量中配置的期望分片大小。
 */
export function normalizePartSize(fileSize: number, preferredPartSize: number): number {
  const minSizeForPartCount = Math.ceil(fileSize / MAX_S3_PARTS);
  return Math.max(preferredPartSize, MIN_PART_SIZE, minSizeForPartCount);
}

/**
 * 根据文件大小和分片大小计算总分片数。
 *
 * @param fileSize 文件总字节数。
 * @param partSize 单个分片字节数。
 */
export function calculateTotalParts(fileSize: number, partSize: number): number {
  return Math.ceil(fileSize / partSize);
}

/** 将 ListParts 返回的 Part 结构转换为运行时已完成分片结构。 */
export function normalizeRemoteParts(parts: Part[]): StoredPart[] {
  return parts.flatMap((part) => {
    if (!part.ETag || !part.PartNumber) return [];
    return [
      {
        ETag: part.ETag,
        PartNumber: part.PartNumber,
        Size: part.Size ?? 0,
      },
    ];
  });
}

/**
 * 统计已完成分片的总字节数。
 *
 * @param parts 已完成分片 Map。
 */
export function sumUploadedBytes(parts: Map<number, StoredPart>): number {
  return Array.from(parts.values()).reduce((total, part) => total + part.Size, 0);
}

/**
 * 按 PartNumber 升序排序分片。
 *
 * @param parts 已完成分片列表。
 */
export function sortParts(parts: StoredPart[]): StoredPart[] {
  return [...parts].sort((left, right) => left.PartNumber - right.PartNumber);
}

/**
 * 将本地分片结构转换为 CompleteMultipartUpload 所需结构。
 *
 * @param part 已完成分片。
 */
export function toCompletedPart(part: StoredPart): CompletedPart {
  return {
    ETag: part.ETag,
    PartNumber: part.PartNumber,
  };
}

/**
 * 校验用户重新选择的文件是否与本地断点匹配。
 *
 * @param file 用户当前选择的文件。
 * @param checkpoint 本地保存的断点。
 */
export function assertCheckpointMatchesFile(file: File, checkpoint: MultipartCheckpoint): void {
  const sameFile =
    checkpoint.file.name === file.name &&
    checkpoint.file.size === file.size &&
    checkpoint.file.lastModified === file.lastModified;

  if (!sameFile) {
    throw new Error('当前选择的文件和本地断点记录不一致，不能继续续传。');
  }
}

/**
 * 如果请求已被中止则抛出 AbortError。
 *
 * @param signal 当前上传请求的 AbortSignal。
 */
export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('上传已被中止。', 'AbortError');
  }
}
