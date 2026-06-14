import { useState, useCallback } from 'react';
import type {
  OSSTokenResponse,
  PersistedUploadCheckpoint,
  UploadCheckpointData,
} from '@oss-test/shared';
import type { OSSMultipartCheckpoint } from 'ali-oss';

interface UseUploadOptions {
  onLog?: (message: string) => void;
}

interface UseUploadReturn {
  uploading: boolean;
  progress: number;
  resumeStatus: 'idle' | 'available' | 'resuming';
  upload: (file: File) => Promise<void>;
}

// OSS 配置（从 Vite 环境变量读取）
const OSS_REGION = import.meta.env.VITE_OSS_REGION;
const OSS_BUCKET = import.meta.env.VITE_OSS_BUCKET;
const PART_SIZE = 1024 * 1024; // 1MB
const STORAGE_PREFIX = 'oss-upload-checkpoint:';
const STORAGE_VERSION = 1;

const createFileId = (file: File) => `${file.name}__${file.size}__${file.lastModified}`;
const createStorageKey = (fileId: string) => `${STORAGE_PREFIX}${fileId}`;
const createObjectKey = (file: File) => `uploads/${file.lastModified}_${file.name}`;

const isCheckpointObject = (value: unknown): value is OSSMultipartCheckpoint => {
  if (!value || typeof value !== 'object') return false;
  const checkpoint = value as OSSMultipartCheckpoint;
  return typeof checkpoint.uploadId === 'string' || Array.isArray(checkpoint.doneParts);
};

const isSameFile = (file: File, meta: PersistedUploadCheckpoint['fileMeta']) =>
  file.name === meta.name &&
  file.size === meta.size &&
  file.lastModified === meta.lastModified &&
  file.type === (meta.type ?? file.type);

const loadSession = (fileId: string): PersistedUploadCheckpoint | null => {
  try {
    const raw = window.localStorage.getItem(createStorageKey(fileId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedUploadCheckpoint;

    if (parsed.version !== STORAGE_VERSION) return null;
    if (parsed.fileId !== fileId) return null;
    if (parsed.bucket !== OSS_BUCKET) return null;
    if (parsed.region !== OSS_REGION) return null;
    if (typeof parsed.objectKey !== 'string' || parsed.objectKey.length === 0) return null;
    if (!isCheckpointObject(parsed.checkpoint)) return null;

    return parsed;
  } catch {
    return null;
  }
};

const saveSession = (session: PersistedUploadCheckpoint) => {
  try {
    window.localStorage.setItem(createStorageKey(session.fileId), JSON.stringify(session));
  } catch {
    // Ignore storage failures and continue without persistence.
  }
};

const clearSession = (fileId: string) => {
  try {
    window.localStorage.removeItem(createStorageKey(fileId));
  } catch {
    // Ignore storage failures.
  }
};

export function useUpload({ onLog }: UseUploadOptions = {}): UseUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resumeStatus, setResumeStatus] = useState<'idle' | 'available' | 'resuming'>('idle');

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setProgress(0);

    const fileId = createFileId(file);
    const storedSession = loadSession(fileId);
    const hasResumeCandidate = storedSession && isSameFile(file, storedSession.fileMeta);
    const objectKey = hasResumeCandidate ? storedSession.objectKey : createObjectKey(file);
    const initialCheckpoint = hasResumeCandidate ? storedSession.checkpoint : undefined;

    if (hasResumeCandidate) {
      setResumeStatus('available');
      onLog?.('检测到未完成上传，准备尝试断点续传...');
    } else {
      if (storedSession) {
        clearSession(fileId);
      }
      setResumeStatus('idle');
    }

    try {
      // 1. 获取 OSS 凭证
      onLog?.('获取 OSS 上传凭证...');
      const tokenRes = await fetch('/api/oss-token');
      const tokenText = await tokenRes.text();

      if (!tokenRes.ok) {
        throw new Error(`API 请求失败 (${tokenRes.status}): ${tokenText || '无响应'}`);
      }

      if (!tokenText) {
        throw new Error('API 返回空响应');
      }

      let tokenData: OSSTokenResponse;
      try {
        tokenData = JSON.parse(tokenText) as OSSTokenResponse;
      } catch {
        throw new Error(`API 返回了非 JSON 响应: ${tokenText.slice(0, 120)}`);
      }

      if (!tokenData.success) {
        throw new Error(tokenData.error || '获取凭证失败');
      }

      const { accessKeyId, accessKeySecret, stsToken } = tokenData.data!;

      // 2. 动态导入 OSS 客户端
      onLog?.('初始化 OSS 客户端...');
      const OSS = (await import('ali-oss')).default;

      const client = new OSS({
        region: OSS_REGION,
        accessKeyId,
        accessKeySecret,
        stsToken,
        bucket: OSS_BUCKET,
      });

      const persistSession = (checkpoint: OSSMultipartCheckpoint) => {
        if (!isCheckpointObject(checkpoint)) return;

        const session: PersistedUploadCheckpoint = {
          version: STORAGE_VERSION,
          fileId,
          fileMeta: {
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            type: file.type,
          },
          objectKey,
          bucket: OSS_BUCKET,
          region: OSS_REGION,
          partSize: PART_SIZE,
          updatedAt: Date.now(),
          checkpoint: checkpoint as UploadCheckpointData,
        };

        saveSession(session);
      };

      const runUpload = async (checkpoint?: OSSMultipartCheckpoint) => {
        return client.multipartUpload(objectKey, file, {
          partSize: PART_SIZE,
          checkpoint,
          progress: (p, nextCheckpoint) => {
            const percent = Math.round(p * 100);
            setProgress(percent);
            onLog?.(`上传进度: ${percent}%`);
            persistSession(nextCheckpoint);
          },
        });
      };

      // 3. 生成或恢复分片上传
      onLog?.(hasResumeCandidate ? `继续上传: ${objectKey}` : `开始上传: ${objectKey}`);
      setResumeStatus(hasResumeCandidate ? 'resuming' : 'idle');

      let result;
      try {
        result = await runUpload(initialCheckpoint);
      } catch (error) {
        if (hasResumeCandidate && initialCheckpoint) {
          clearSession(fileId);
          setResumeStatus('idle');
          onLog?.('断点无效，已清除旧记录，正在重新开始上传...');
          result = await runUpload();
        } else {
          throw error;
        }
      }

      onLog?.('上传完成!');
      onLog?.(`ETag: ${result.etag}`);
      onLog?.(`URL: https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com/${objectKey}`);

      clearSession(fileId);
      setProgress(100);
      setResumeStatus('idle');
    } finally {
      setUploading(false);
    }
  }, [onLog]);

  return { uploading, progress, resumeStatus, upload };
}
