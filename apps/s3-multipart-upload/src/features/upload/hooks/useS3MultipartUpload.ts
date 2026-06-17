import { useCallback, useMemo, useRef, useState } from 'react';
import {
  loadCompletedUpload,
  loadCheckpoint,
  readRuntimeConfig,
  removeCompletedUpload,
  removeCheckpoint,
  S3MultipartUpload,
  S3_UPLOAD_EVENTS,
  saveCompletedUpload,
  saveCheckpoint,
} from '@/libs/s3-upload';
import type {
  CompletedUploadRecord,
  MultipartCheckpoint,
  UploadIdEvent,
  UploadProgressEvent,
  UploadResult,
} from '@/libs/s3-upload';
import { toReadableError } from '../utils/format';
import { INITIAL_PROGRESS, type UploadStatus, type UseS3MultipartUploadReturn } from '../types';
import { useSimpleUploadProgress } from './useSimpleUploadProgress';
import { useUploadLogger } from './useUploadLogger';

export type { UploadLogEntry, UploadStatus } from '../types';

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
  const prepareUploadRun = useCallback((file: File, mode: 'auto' | 'force-new') => {
    pauseRequestedRef.current = false;
    abortRequestedRef.current = false;
    activeFileRef.current = file;
    setStatus('uploading');
    setResult(null);
    setErrorMessage(null);

    if (mode === 'force-new') {
      removeCheckpoint(file);
      setCheckpoint(null);
    }
  }, []);

  /** 统一处理上传异常，并区分暂停、终止和真实错误。 */
  const handleUploadError = useCallback(
    (error: unknown) => {
      stopSimpleProgress();

      if (pauseRequestedRef.current) {
        setStatus('paused');
        appendLog('info', '上传已暂停，断点已保留在 localStorage。');
        return;
      }

      if (abortRequestedRef.current) {
        return;
      }

      const message = toReadableError(error);
      setStatus('error');
      setErrorMessage(message);
      appendLog('error', message);
    },
    [appendLog, stopSimpleProgress]
  );

  /** 尝试复用同浏览器本地完成记录，成功时直接写入上传结果。 */
  const tryUseCompletedUpload = useCallback(
    async (file: File, record: CompletedUploadRecord): Promise<boolean> => {
      if (record.bucket !== config.bucket || record.region !== config.region) {
        removeCompletedUpload(file);
        appendLog('info', '本地完成记录与当前 Bucket/Region 不一致，已忽略。');
        return false;
      }

      if (config.missingKeys.length > 0) return false;

      const startedAt = performance.now();
      const verifier = new S3MultipartUpload(config);
      appendLog('info', `检测到本地完成记录，正在校验远端对象：${record.key}`);

      try {
        const objectInfo = await verifier.getCompletedObjectInfo(record.key);

        if (objectInfo.size !== file.size) {
          removeCompletedUpload(file);
          appendLog('info', '本地完成记录已失效，远端对象大小与当前文件不一致。');
          return false;
        }

        const uploadResult: UploadResult = {
          mode: 'local',
          bucket: record.bucket,
          region: record.region,
          key: record.key,
          eTag: objectInfo.eTag ?? record.eTag,
          location: record.location,
          publicUrl: record.publicUrl,
          durationMs: Math.round(performance.now() - startedAt),
        };

        removeCheckpoint(file);
        setCheckpoint(null);
        setResult(uploadResult);
        setStatus('success');
        setErrorMessage(null);
        setProgress({
          phase: 'done',
          mode: 'local',
          key: record.key,
          percent: 100,
          uploadedBytes: file.size,
          totalBytes: file.size,
        });
        appendLog('success', `命中本地完成记录：${record.key}`);
        return true;
      } catch (error) {
        removeCompletedUpload(file);
        appendLog('info', `本地完成记录校验失败，已改为正常上传：${toReadableError(error)}`);
        return false;
      } finally {
        verifier.destroy();
      }
    },
    [appendLog, config]
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

      const completedRecord = loadCompletedUpload(file);
      if (completedRecord) {
        appendLog('info', `检测到本地完成记录，点击上传时会先校验：${completedRecord.key}`);
      }
    },
    [appendLog, clearLogs]
  );

  /** 执行上传主流程：本地复用、断点续传、新上传按顺序自动选择。 */
  const runUpload = useCallback(
    async (mode: 'auto' | 'force-new') => {
      const file = selectedFile;
      if (!file) {
        setErrorMessage('请先选择文件。');
        return;
      }

      prepareUploadRun(file, mode);

      try {
        appendLog('info', mode === 'force-new' ? '忽略本地记录，开始重新上传。' : '开始上传。');

        if (mode === 'auto') {
          const completedRecord = loadCompletedUpload(file);
          if (completedRecord && await tryUseCompletedUpload(file, completedRecord)) {
            return;
          }
        }

        const uploader = getUploader();
        const shouldResume = mode === 'auto' && checkpoint;
        const isSimpleUpload = !uploader.shouldUseMultipart(file);
        if (!shouldResume && isSimpleUpload) startSimpleProgress(file);

        appendLog('info', shouldResume ? '开始断点续传。' : '开始新上传。');
        const uploadResult =
          shouldResume
            ? await uploader.resumeMultipartUpload(file, checkpoint)
            : await uploader.upload(file);

        stopSimpleProgress();
        removeCheckpoint(file);
        saveCompletedUpload(file, uploadResult);
        setCheckpoint(null);
        setResult(uploadResult);
        setStatus('success');
        appendLog('success', `上传完成：${uploadResult.key}`);
      } catch (error) {
        handleUploadError(error);
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
      tryUseCompletedUpload,
    ]
  );

  /** 自动选择本地复用、断点续传或新上传。 */
  const startUpload = useCallback(async () => {
    await runUpload('auto');
  }, [runUpload]);

  /** 忽略本地记录和断点，重新开始上传。 */
  const forceNewUpload = useCallback(async () => {
    await runUpload('force-new');
  }, [runUpload]);

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
      } else if (checkpoint) {
        const uploader = getUploader();
        await uploader.abortMultipartUpload(checkpoint.uploadId, checkpoint.key);
      }

      if (file) removeCheckpoint(file);
      setCheckpoint(null);
      setStatus('cancelled');
      setErrorMessage(null);
      appendLog('info', checkpoint ? `已终止远端分片任务：${checkpoint.uploadId}` : '分片上传已终止。');
    } catch (error) {
      const message = `终止分片失败：${toReadableError(error)}`;
      setStatus('error');
      setErrorMessage(message);
      appendLog('error', message);
    } finally {
      if (!activeUploader) {
        abortRequestedRef.current = false;
      }
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
    startUpload,
    forceNewUpload,
    pauseUpload,
    abortMultipartUpload,
    createSignedUrl,
    clear,
  };
}
