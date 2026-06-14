import { useState, useCallback } from 'react';
import type { OSSTokenResponse } from '@oss-test/shared';

interface UseUploadOptions {
  onLog?: (message: string) => void;
}

interface UseUploadReturn {
  uploading: boolean;
  progress: number;
  upload: (file: File) => Promise<void>;
}

// OSS 配置（从 Vite 环境变量读取）
const OSS_REGION = import.meta.env.VITE_OSS_REGION;
const OSS_BUCKET = import.meta.env.VITE_OSS_BUCKET;
const PART_SIZE = 1024 * 1024; // 1MB

export function useUpload({ onLog }: UseUploadOptions = {}): UseUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setProgress(0);

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

      // 3. 生成分片上传
      const objectKey = `uploads/${Date.now()}_${file.name}`;
      onLog?.(`开始分片上传: ${objectKey}`);

      const result = await client.multipartUpload(objectKey, file, {
        partSize: PART_SIZE,
        progress: (p) => {
          const percent = Math.round(p * 100);
          setProgress(percent);
          onLog?.(`上传进度: ${percent}%`);
        },
      });

      onLog?.(`上传完成!`);
      onLog?.(`ETag: ${result.etag}`);
      onLog?.(`URL: https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com/${objectKey}`);

      setProgress(100);
    } finally {
      setUploading(false);
    }
  }, [onLog]);

  return { uploading, progress, upload };
}