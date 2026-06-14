import { useCallback, useMemo, useState } from 'react';
import type { OSSPostPolicy, OSSPostPolicyResponse } from '@oss-test/shared';
import { createObjectKey } from '@/utils/objectKey';

export interface UploadLogEntry {
  level: 'info' | 'success' | 'error';
  message: string;
}

export interface UploadSuccessResult {
  objectKey: string;
  objectUrl: string;
  host: string;
  policy: OSSPostPolicy;
  httpStatus: number;
}

interface UsePostUploadReturn {
  uploading: boolean;
  status: 'idle' | 'success' | 'error';
  errorMessage: string | null;
  logs: UploadLogEntry[];
  result: UploadSuccessResult | null;
  upload: (file: File) => Promise<void>;
  clear: () => void;
}

const MAX_FORM_UPLOAD_SIZE = 5 * 1024 * 1024 * 1024;

export function usePostUpload(): UsePostUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<UploadLogEntry[]>([]);
  const [result, setResult] = useState<UploadSuccessResult | null>(null);

  const appendLog = useCallback((level: UploadLogEntry['level'], message: string) => {
    setLogs((prev) => [...prev, { level, message }]);
  }, []);

  const clear = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
    setLogs([]);
    setResult(null);
  }, []);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setStatus('idle');
    setErrorMessage(null);
    setLogs([]);
    setResult(null);

    try {
      if (file.size > MAX_FORM_UPLOAD_SIZE) {
        throw new Error('表单直传仅支持不超过 5 GB 的文件。');
      }

      appendLog('info', '请求 /api/oss-post-policy 获取表单直传签名。');
      const policyResponse = await fetch('/api/oss-post-policy');
      const policyText = await policyResponse.text();

      if (!policyResponse.ok) {
        throw new Error(`获取 POST Policy 失败 (${policyResponse.status}): ${policyText || '无响应'}`);
      }

      const policyPayload = JSON.parse(policyText) as OSSPostPolicyResponse;
      if (!policyPayload.success || !policyPayload.data) {
        throw new Error(policyPayload.error || policyPayload.message || 'POST Policy 响应无效');
      }

      const policy = policyPayload.data;
      if (file.size > policy.maxSize) {
        throw new Error(`文件超过当前策略允许的大小限制：${policy.maxSize} 字节。`);
      }

      const objectKey = createObjectKey(policy.keyPrefix, file.name);
      appendLog('info', `已获取签名，准备直传到 OSS：${policy.host}`);
      appendLog('info', `对象 key: ${objectKey}`);

      const formData = new FormData();
      formData.append('key', objectKey);
      formData.append('success_action_status', policy.fields.successActionStatus);
      formData.append('policy', policy.fields.policy);
      formData.append('x-oss-signature', policy.fields.xOssSignature);
      formData.append('x-oss-signature-version', policy.fields.xOssSignatureVersion);
      formData.append('x-oss-credential', policy.fields.xOssCredential);
      formData.append('x-oss-date', policy.fields.xOssDate);
      formData.append('x-oss-security-token', policy.fields.xOssSecurityToken);
      formData.append('x-oss-forbid-overwrite', policy.fields.xOssForbidOverwrite);
      formData.append('file', file);

      appendLog('info', '开始浏览器直传 OSS，file 字段已作为最后一个表单字段追加。');
      const uploadResponse = await fetch(policy.host, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const failureText = await uploadResponse.text();
        throw new Error(buildUploadErrorMessage(uploadResponse.status, failureText, policy));
      }

      appendLog('success', `OSS 直传成功，状态码 ${uploadResponse.status}。`);
      const objectUrl = `${policy.host}/${objectKey}`;
      setResult({
        objectKey,
        objectUrl,
        host: policy.host,
        policy,
        httpStatus: uploadResponse.status,
      });
      setStatus('success');
    } catch (error) {
      const message = toReadableErrorMessage(error);
      appendLog('error', message);
      setErrorMessage(message);
      setStatus('error');
    } finally {
      setUploading(false);
    }
  }, [appendLog]);

  return useMemo(
    () => ({
      uploading,
      status,
      errorMessage,
      logs,
      result,
      upload,
      clear,
    }),
    [clear, errorMessage, logs, result, status, upload, uploading]
  );
}

function buildUploadErrorMessage(status: number, failureText: string, policy: OSSPostPolicy): string {
  if (failureText.includes('FileAlreadyExists') && policy.fields.xOssForbidOverwrite === 'true') {
    return '上传失败：对象已存在，当前策略启用了覆盖保护（x-oss-forbid-overwrite=true）。';
  }

  if (failureText.includes('AccessDenied') || failureText.includes('InvalidPolicyDocument')) {
    return `上传失败：OSS 拒绝了当前表单策略（HTTP ${status}）。请检查 Policy 条件、CORS 与 Bucket 配置。`;
  }

  if (failureText.includes('EntityTooLarge')) {
    return '上传失败：文件大小超过 OSS 或当前策略允许的上限。';
  }

  if (failureText.trim().startsWith('<')) {
    return `上传失败：OSS 返回了错误响应（HTTP ${status}）。请检查 CORS、Policy 和表单字段。`;
  }

  return `上传失败（HTTP ${status}）：${failureText || 'OSS 返回空错误信息'}`;
}

function toReadableErrorMessage(error: unknown): string {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return '上传失败：浏览器无法完成直传请求。请优先检查 OSS Bucket 的 CORS 配置、Host 是否可达，以及当前表单签名是否有效。';
  }

  return error instanceof Error ? error.message : '未知错误';
}
