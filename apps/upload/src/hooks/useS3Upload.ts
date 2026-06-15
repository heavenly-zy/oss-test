import { useCallback, useMemo, useRef, useState } from 'react';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type {
  S3UploadResult,
  UploadLogEntry,
  UploadProgress,
  UploadStatus,
  UploadToken,
  UploadTokenResponse,
} from '@oss-test/shared';
import { toReadableErrorMessage } from '@/utils/errors';

interface UseS3UploadReturn {
  status: UploadStatus;
  progress: UploadProgress;
  selectedFile: File | null;
  token: UploadToken | null;
  result: S3UploadResult | null;
  logs: UploadLogEntry[];
  errorMessage: string | null;
  selectFile: (file: File | null) => void;
  upload: () => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
  clear: () => void;
}

const PART_SIZE = 10 * 1024 * 1024;
const QUEUE_SIZE = 4;

export function useS3Upload(): UseS3UploadReturn {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState<UploadProgress>({
    percent: 0,
    uploaded: 0,
    total: 0,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [token, setToken] = useState<UploadToken | null>(null);
  const [result, setResult] = useState<S3UploadResult | null>(null);
  const [logs, setLogs] = useState<UploadLogEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentUploadRef = useRef<Upload | null>(null);
  const tokenAbortRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);

  const appendLog = useCallback((level: UploadLogEntry['level'], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        level,
        message,
        time: new Date().toISOString(),
      },
    ]);
  }, []);

  const clear = useCallback(() => {
    setStatus('idle');
    setProgress({ percent: 0, uploaded: 0, total: 0 });
    setSelectedFile(null);
    setToken(null);
    setResult(null);
    setLogs([]);
    setErrorMessage(null);
    cancelRequestedRef.current = false;
  }, []);

  const selectFile = useCallback(
    (file: File | null) => {
      setSelectedFile(file);
      setStatus('idle');
      setProgress({
        percent: 0,
        uploaded: 0,
        total: file?.size ?? 0,
      });
      setToken(null);
      setResult(null);
      setErrorMessage(null);
      setLogs([]);

      if (file) {
        appendLog('info', `已选择文件：${file.name}（${file.size} 字节）。`);
      }
    },
    [appendLog]
  );

  const upload = useCallback(async () => {
    const file = selectedFile;
    if (!file) {
      setErrorMessage('请先选择文件，再开始上传。');
      return;
    }

    let client: S3Client | null = null;
    let lastLoggedPercent = 0;
    cancelRequestedRef.current = false;
    setErrorMessage(null);
    setResult(null);
    setToken(null);
    setProgress({ percent: 0, uploaded: 0, total: file.size });

    try {
      setStatus('requestingToken');
      appendLog('info', '正在请求 /api/upload-token 获取上传凭证。');

      const abortController = new AbortController();
      tokenAbortRef.current = abortController;
      const uploadToken = await fetchUploadToken(file, abortController.signal);
      tokenAbortRef.current = null;

      setToken(uploadToken);
      appendLog('success', `已获取对象 ${uploadToken.objectKey} 的上传凭证。`);
      appendLog('info', '正在初始化 S3Client。');

      client = new S3Client({
        region: uploadToken.region,
        endpoint: uploadToken.endpoint,
        forcePathStyle: false,
        credentials: {
          accessKeyId: uploadToken.accessKeyId,
          secretAccessKey: uploadToken.secretAccessKey,
          sessionToken: uploadToken.sessionToken,
        },
      });

      const managedUpload = new Upload({
        client,
        params: {
          Bucket: uploadToken.bucket,
          Key: uploadToken.objectKey,
          Body: file,
          ContentType: file.type || 'application/octet-stream',
        },
        partSize: PART_SIZE,
        queueSize: QUEUE_SIZE,
        leavePartsOnError: false,
      });

      currentUploadRef.current = managedUpload;
      setStatus('uploading');
      appendLog('info', '开始通过浏览器直传到 OSS S3 兼容接口。');
      const startedAt = performance.now();
      let uploadedBytes = 0;
      let displayedPercent = 0;

      managedUpload.on('httpUploadProgress', (event) => {
        if (typeof event.loaded === 'number') {
          uploadedBytes = Math.max(uploadedBytes, event.loaded);
        }

        const total =
          typeof event.total === 'number' && event.total > 0
            ? event.total
            : file.size;
        displayedPercent =
          total > 0
            ? Math.max(displayedPercent, Math.min(100, Math.round((uploadedBytes / total) * 100)))
            : displayedPercent;

        if (displayedPercent >= lastLoggedPercent + 10 || displayedPercent === 100) {
          lastLoggedPercent = displayedPercent;
          appendLog('info', `上传进度：${displayedPercent}%。`);
        }

        setProgress({
          percent: displayedPercent,
          uploaded: uploadedBytes,
          total,
        });
      });

      const uploadOutput = (await managedUpload.done()) as {
        ETag?: string;
        Location?: string;
      };
      const durationMs = Math.round(performance.now() - startedAt);

      setProgress({ percent: 100, uploaded: file.size, total: file.size });
      setResult({
        provider: uploadToken.provider,
        bucket: uploadToken.bucket,
        region: uploadToken.region,
        endpoint: uploadToken.endpoint,
        objectKey: uploadToken.objectKey,
        objectUrl: uploadToken.objectUrl,
        eTag: uploadOutput.ETag,
        location: uploadOutput.Location,
        durationMs,
      });
      setStatus('success');
      appendLog('success', `上传完成，耗时 ${durationMs} 毫秒。`);
    } catch (error) {
      if (cancelRequestedRef.current) {
        setStatus('cancelled');
        setErrorMessage('上传已取消。');
        appendLog('info', '上传已取消。');
        return;
      }

      const message = toReadableErrorMessage(error);
      setStatus('error');
      setErrorMessage(message);
      appendLog('error', message);
    } finally {
      tokenAbortRef.current = null;
      currentUploadRef.current = null;
      cancelRequestedRef.current = false;
      client?.destroy();
    }
  }, [appendLog, selectedFile]);

  const cancel = useCallback(async () => {
    const tokenAbort = tokenAbortRef.current;
    const currentUpload = currentUploadRef.current;

    if (!tokenAbort && !currentUpload) return;

    cancelRequestedRef.current = true;
    appendLog('info', '正在取消上传。');
    tokenAbort?.abort();

    if (currentUpload) {
      await currentUpload.abort().catch(() => undefined);
    }
  }, [appendLog]);

  const retry = useCallback(async () => {
    appendLog('info', '正在使用新的上传凭证重试。');
    await upload();
  }, [appendLog, upload]);

  return useMemo(
    () => ({
      status,
      progress,
      selectedFile,
      token,
      result,
      logs,
      errorMessage,
      selectFile,
      upload,
      cancel,
      retry,
      clear,
    }),
    [
      cancel,
      clear,
      errorMessage,
      logs,
      progress,
      result,
      retry,
      selectFile,
      selectedFile,
      status,
      token,
      upload,
    ]
  );
}

async function fetchUploadToken(file: File, signal: AbortSignal): Promise<UploadToken> {
  const params = new URLSearchParams({
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    size: String(file.size),
  });
  const response = await fetch(`/api/upload-token?${params.toString()}`, { signal });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`上传凭证请求失败，HTTP 状态码 ${response.status}。`);
  }

  if (!text) {
    throw new Error('上传凭证响应为空。');
  }

  let payload: UploadTokenResponse;
  try {
    payload = JSON.parse(text) as UploadTokenResponse;
  } catch {
    throw new Error(`上传凭证响应不是 JSON：${text.slice(0, 120)}`);
  }

  if (!payload.success || !payload.data) {
    throw new Error(payload.error || payload.message || '上传凭证响应无效。');
  }

  const token = payload.data;
  if (
    !token.objectKey ||
    !token.bucket ||
    !token.region ||
    !token.accessKeyId ||
    !token.secretAccessKey ||
    !token.sessionToken
  ) {
    throw new Error('上传凭证缺少必要的 S3 字段。');
  }

  return token;
}
