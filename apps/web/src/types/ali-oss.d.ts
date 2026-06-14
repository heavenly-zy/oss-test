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

  export interface OSSMultipartCheckpoint {
    uploadId?: string;
    fileSize?: number;
    partSize?: number;
    doneParts?: Array<{
      number?: number;
      etag?: string;
    }>;
    name?: string;
    bucket?: string;
    key?: string;
    [key: string]: unknown;
  }

  export interface MultipartUploadOptions {
    partSize?: number;
    checkpoint?: OSSMultipartCheckpoint;
    progress?: (progress: number, checkpoint: OSSMultipartCheckpoint) => void;
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