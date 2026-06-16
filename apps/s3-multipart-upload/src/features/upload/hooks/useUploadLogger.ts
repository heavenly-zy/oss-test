import { useCallback, useState } from 'react';
import type { UploadLogEntry } from '../types';

/**
 * 上传日志状态封装。
 *
 * 统一给日志补充时间戳，页面组件只负责展示。
 */
export function useUploadLogger() {
  const [logs, setLogs] = useState<UploadLogEntry[]>([]);

  /** 追加一条上传日志。 */
  const appendLog = useCallback((level: UploadLogEntry['level'], message: string) => {
    setLogs((prev) => [...prev, { level, message, time: Date.now() }]);
  }, []);

  /** 清空全部上传日志。 */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    appendLog,
    clearLogs,
  };
}
