import { useCallback, useMemo, useRef, useState } from 'react';
import { readRuntimeConfig } from '@/config';
import { S3MultipartUpload, S3_UPLOAD_EVENTS } from '@/lib/S3MultipartUpload';
import type { MultipartCheckpoint, UploadIdEvent, UploadProgressEvent, UploadResult } from '@/lib/types';
import { loadCheckpoint, removeCheckpoint, saveCheckpoint } from '@/utils/checkpointStore';
import { toReadableError } from '@/utils/format';
import { INITIAL_PROGRESS, type UploadStatus, type UseS3MultipartUploadReturn } from './types';
import { useSimpleUploadProgress } from './useSimpleUploadProgress';
import { useUploadLogger } from './useUploadLogger';

export type { UploadLogEntry, UploadStatus } from './types';

/**
 * 页面级上传状态管理 Hook。
 *
 * 负责连接 UI 与 `S3MultipartUpload`：选择文件、保存/加载断点、暂停、终止、
 * 续传、生成预签名读取 URL，以及维护日志和错误状态。
 */
export function useS3MultipartUpload(): UseS3MultipartUploadReturn {
  const config = useMemo(readRuntimeConfig, []);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [checkpoint, setCheckpoint] = useState<MultipartCheckpoint | null>(null);
  const [progress, setProgress] = useState<UploadProgressEvent | null>(INITIAL_PROGRESS);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploaderRef = useRef<S3MultipartUpload | null>(null);
  const activeFileRef = useRef<File | null>(null);
  const pauseRequestedRef = useRef(false);
  const abortRequestedRef = useRef(false);
  const { logs, appendLog, clearLogs } = useUploadLogger();
  const { startSimpleProgress, stopSimpleProgress } = useSimpleUploadProgress(setProgress);

  /** 接收上传类派发的进度事件，并同步到页面状态。 */
  const handleProgress = useCallback((event: UploadProgressEvent) => {
    setProgress(event);
  }, []);

  /** 接收上传类派发的断点事件，并保存到 localStorage。 */
  const handleCheckpoint = useCallback((nextCheckpoint: MultipartCheckpoint) => {
    const file = activeFileRef.current;
    if (!file) return;

    setCheckpoint(nextCheckpoint);
    saveCheckpoint(file, nextCheckpoint);
  }, []);

  /** 获取或创建当前上传任务使用的 S3MultipartUpload 实例。 */
  const getUploader = useCallback(() => {
    if (config.missingKeys.length > 0) {
      throw new Error(`缺少前端环境变量：${config.missingKeys.join(', ')}`);
    }

    if (!uploaderRef.current) {
      const uploader = new S3MultipartUpload(config);

      uploader.on(S3_UPLOAD_EVENTS.UPLOAD_PROGRESS, handleProgress);
      uploader.on(S3_UPLOAD_EVENTS.CHECKPOINT_UPDATE, handleCheckpoint);
      uploader.on(S3_UPLOAD_EVENTS.UPLOAD_ID, ({ uploadId, key }: UploadIdEvent) => {
        appendLog('info', `已创建分片任务：${uploadId}（${key}）`);
      });

      uploaderRef.current = uploader;
    }

    return uploaderRef.current;
  }, [appendLog, config, handleCheckpoint, handleProgress]);

  /** 销毁当前上传实例，释放 S3Client 引用。 */
  const disposeUploader = useCallback(() => {
    uploaderRef.current?.destroy();
    uploaderRef.current = null;
  }, []);

  /** 开始上传前重置运行时状态。 */
  const prepareUploadRun = useCallback((file: File, mode: 'new' | 'resume') => {
    pauseRequestedRef.current = false;
    abortRequestedRef.current = false;
    activeFileRef.current = file;
    setStatus('uploading');
    setResult(null);
    setErrorMessage(null);

    if (mode === 'new') {
      removeCheckpoint(file);
      setCheckpoint(null);
    }
  }, []);

  /** 统一处理上传异常，并区分暂停、终止和真实错误。 */
  const handleUploadError = useCallback(
    (error: unknown, file: File) => {
      stopSimpleProgress();

      if (pauseRequestedRef.current) {
        setStatus('paused');
        appendLog('info', '上传已暂停，断点已保留在 localStorage。');
        return;
      }

      if (abortRequestedRef.current) {
        removeCheckpoint(file);
        setCheckpoint(null);
        setStatus('cancelled');
        appendLog('info', '分片上传已终止。');
        return;
      }

      const message = toReadableError(error);
      setStatus('error');
      setErrorMessage(message);
      appendLog('error', message);
    },
    [appendLog, stopSimpleProgress]
  );

  /** 选择文件，并尝试加载该文件对应的本地断点。 */
  const selectFile = useCallback(
    (file: File | null) => {
      activeFileRef.current = file;
      setSelectedFile(file);
      setStatus('idle');
      setResult(null);
      setErrorMessage(null);
      clearLogs();
      setProgress(file ? { ...INITIAL_PROGRESS, totalBytes: file.size } : INITIAL_PROGRESS);

      if (!file) {
        setCheckpoint(null);
        return;
      }

      const savedCheckpoint = loadCheckpoint(file);
      setCheckpoint(savedCheckpoint);
      appendLog('info', `已选择文件：${file.name}`);

      if (savedCheckpoint) {
        appendLog('info', `检测到本地断点：${savedCheckpoint.uploadId}`);
      }
    },
    [appendLog, clearLogs]
  );

  /** 执行上传主流程，可选择重新上传或基于 checkpoint 续传。 */
  const runUpload = useCallback(
    async (mode: 'new' | 'resume') => {
      const file = selectedFile;
      if (!file) {
        setErrorMessage('请先选择文件。');
        return;
      }

      prepareUploadRun(file, mode);

      const uploader = getUploader();
      const isSimpleUpload = !uploader.shouldUseMultipart(file);
      if (isSimpleUpload) startSimpleProgress(file);

      try {
        appendLog('info', mode === 'resume' ? '开始断点续传。' : '开始上传。');
        const uploadResult =
          mode === 'resume' && checkpoint
            ? await uploader.resumeMultipartUpload(file, checkpoint)
            : await uploader.upload(file);

        stopSimpleProgress();
        removeCheckpoint(file);
        setCheckpoint(null);
        setResult(uploadResult);
        setStatus('success');
        appendLog('success', `上传完成：${uploadResult.key}`);
      } catch (error) {
        handleUploadError(error, file);
      } finally {
        pauseRequestedRef.current = false;
        abortRequestedRef.current = false;
        disposeUploader();
      }
    },
    [
      appendLog,
      checkpoint,
      disposeUploader,
      getUploader,
      handleUploadError,
      prepareUploadRun,
      selectedFile,
      startSimpleProgress,
      stopSimpleProgress,
    ]
  );

  /** 忽略旧断点，重新开始上传。 */
  const startNewUpload = useCallback(async () => {
    await runUpload('new');
  }, [runUpload]);

  /** 使用当前文件命中的 checkpoint 继续上传。 */
  const resumeUpload = useCallback(async () => {
    if (!checkpoint) {
      setErrorMessage('当前文件没有可用断点。');
      return;
    }

    await runUpload('resume');
  }, [checkpoint, runUpload]);

  /** 暂停当前上传，但保留远端分片和本地断点。 */
  const pauseUpload = useCallback(async () => {
    pauseRequestedRef.current = true;
    await uploaderRef.current?.pauseActiveUpload();
  }, []);

  /** 终止远端 multipart 任务，并清理本地断点。 */
  const abortMultipartUpload = useCallback(async () => {
    const file = selectedFile;
    const activeUploader = uploaderRef.current;
    abortRequestedRef.current = true;

    try {
      if (activeUploader) {
        await activeUploader.abortActiveMultipartUpload();
        return;
      }

      if (checkpoint) {
        const uploader = getUploader();
        await uploader.abortMultipartUpload(checkpoint.uploadId, checkpoint.key);
        appendLog('info', `已终止远端分片任务：${checkpoint.uploadId}`);
      }
    } finally {
      if (file) removeCheckpoint(file);
      setCheckpoint(null);
      setStatus('cancelled');
      disposeUploader();
    }
  }, [appendLog, checkpoint, disposeUploader, getUploader, selectedFile]);

  /** 为上传完成的对象生成预签名读取地址。 */
  const createSignedUrl = useCallback(async () => {
    if (!result) return;

    try {
      const uploader = getUploader();
      const signedUrl = await uploader.createPresignedReadUrl(result.key);
      setResult({ ...result, signedUrl });
      appendLog('success', '已生成预签名读取地址。');
    } catch (error) {
      const message = toReadableError(error);
      setErrorMessage(message);
      appendLog('error', message);
    } finally {
      disposeUploader();
    }
  }, [appendLog, disposeUploader, getUploader, result]);

  /** 清空页面状态和当前上传实例。 */
  const clear = useCallback(() => {
    stopSimpleProgress();
    disposeUploader();
    activeFileRef.current = null;
    setStatus('idle');
    setSelectedFile(null);
    setCheckpoint(null);
    setProgress(INITIAL_PROGRESS);
    setResult(null);
    clearLogs();
    setErrorMessage(null);
  }, [clearLogs, disposeUploader, stopSimpleProgress]);

  return {
    config,
    status,
    selectedFile,
    checkpoint,
    progress,
    result,
    logs,
    errorMessage,
    selectFile,
    startNewUpload,
    resumeUpload,
    pauseUpload,
    abortMultipartUpload,
    createSignedUrl,
    clear,
  };
}
