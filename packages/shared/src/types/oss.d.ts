export interface OSSConfig {
    region: string;
    bucket: string;
    endpoint?: string;
}
export interface OSSToken {
    accessKeyId: string;
    accessKeySecret: string;
    stsToken: string;
    expiration: string;
}
export interface UploadResult {
    etag: string;
    name: string;
    url: string;
}
export interface UploadCheckpoint {
    file: File;
    name: string;
    fileSize: number;
    partSize: number;
    uploadId: string;
    bucket: string;
    key: string;
    loaded?: number;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
export type OSSTokenResponse = ApiResponse<OSSToken>;
export interface UploadProgress {
    percent: number;
    uploaded: number;
    total: number;
}
