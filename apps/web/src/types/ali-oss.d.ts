declare module 'ali-oss' {
  export interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    stsToken?: string;
    bucket: string;
  }

  export interface UploadResult {
    name: string;
    etag: string;
  }

  export interface MultipartUploadOptions {
    partSize?: number;
    checkpoint?: unknown;
    progress?: (progress: number, checkpoint: unknown) => void;
  }

  export default class OSS {
    constructor(options: OSSOptions);
    multipartUpload(
      name: string,
      file: File,
      options?: MultipartUploadOptions
    ): Promise<UploadResult>;
  }
}