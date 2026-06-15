export function toReadableErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '上传已取消。';
  }

  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return '无法连接上传服务或 OSS endpoint，请检查 API 服务和 Bucket CORS 配置。';
  }

  if (error instanceof Error) {
    if (error.message.includes('ExpiredToken')) {
      return '临时上传凭证已过期，请重新上传。';
    }

    if (error.message.includes('AccessDenied')) {
      return 'OSS 拒绝了上传请求，请检查 STS policy、Bucket 权限和 CORS 配置。';
    }

    if (error.message.includes('CORS')) {
      return '浏览器直传因 CORS 失败，请检查 Bucket CORS 规则。';
    }

    return error.message;
  }

  return '未知上传错误。';
}
