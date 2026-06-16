import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { UploadProgressEvent } from '@/lib/types';

/**
 * 普通 PutObject 上传的 UI 进度模拟。
 *
 * 浏览器端 PutObject 不一定能稳定拿到逐字节进度，因此用定时器推进到 90%，
 * 真正上传成功后再由上传流程设置为 100%。
 */
export function useSimpleUploadProgress(
  setProgress: Dispatch<SetStateAction<UploadProgressEvent | null>>
) {
  const timerRef = useRef<number | null>(null);

  /** 停止普通上传模拟进度定时器。 */
  const stopSimpleProgress = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** 启动普通上传模拟进度定时器。 */
  const startSimpleProgress = useCallback(
    (file: File) => {
      stopSimpleProgress();

      timerRef.current = window.setInterval(() => {
        setProgress((current) => {
          const currentPercent = current?.percent ?? 0;
          const percent = Math.min(90, currentPercent + 8);

          return {
            phase: 'uploading',
            mode: 'simple',
            key: current?.key ?? '',
            percent,
            uploadedBytes: Math.round((percent / 100) * file.size),
            totalBytes: file.size,
          };
        });
      }, 180);
    },
    [setProgress, stopSimpleProgress]
  );

  return {
    startSimpleProgress,
    stopSimpleProgress,
  };
}
