import OSS from 'ali-oss';

/**
 * 获取 OSS 上传凭证
 */
export async function fetchOSSInfo() {
  const response = await fetch('/api/oss-token');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取凭证失败');
  }
  return result.data;
}

/**
 * 创建 OSS 客户端
 */
export async function createOSSClient() {
  const ossInfo = await fetchOSSInfo();
  return new OSS({
    region: 'oss-cn-beijing',
    accessKeyId: ossInfo.accessKeyId,
    accessKeySecret: ossInfo.accessKeySecret,
    stsToken: ossInfo.stsToken,
    bucket: 'gugugaga-bucket',
  });
}

/**
 * 分片上传文件
 * @param {File} file - 要上传的文件
 * @param {Function} onProgress - 进度回调 (percent: number) => void
 * @returns {Promise<{etag: string, name: string}>}
 */
export async function multipartUpload(file, onProgress) {
  const client = await createOSSClient();
  const objectKey = `uploads/${Date.now()}_${file.name}`;

  const result = await client.multipartUpload(objectKey, file, {
    partSize: 1024 * 1024, // 1MB
    progress: (p) => {
      onProgress?.(Math.round(p * 100));
    },
  });

  return {
    etag: result.etag,
    name: objectKey,
    url: `https://gugugaga-bucket.oss-cn-beijing.aliyuncs.com/${objectKey}`,
  };
}

/**
 * 断点续传上传
 * @param {File} file - 要上传的文件
 * @param {Function} onProgress - 进度回调 (percent: number) => void
 * @param {Object} checkpoint - 断点信息，null 表示新上传
 * @returns {Promise<{etag: string, name: string, checkpoint: Object}>}
 */
export async function resumableUpload(file, onProgress, checkpoint = null) {
  const client = await createOSSClient();
  const objectKey = `uploads/${Date.now()}_${file.name}`;

  const result = await client.multipartUpload(objectKey, file, {
    partSize: 1024 * 1024, // 1MB
    checkpoint,
    progress: (p, cpt) => {
      onProgress?.(Math.round(p * 100));
    },
  });

  return {
    etag: result.etag,
    name: objectKey,
    url: `https://gugugaga-bucket.oss-cn-beijing.aliyuncs.com/${objectKey}`,
    checkpoint: result.checkpoint,
  };
}

/**
 * 格式化文件大小
 */
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}