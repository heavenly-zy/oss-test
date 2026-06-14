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
export interface UploadFileMeta {
    name: string;
    size: number;
    lastModified: number;
    type?: string;
}
export interface UploadCheckpointData {
    uploadId?: string;
    fileSize?: number;
    partSize?: number;
    doneParts?: Array<{
        number?: number;
        etag?: string;
    }>;
    [key: string]: unknown;
}
export interface PersistedUploadCheckpoint {
    version: 1;
    fileId: string;
    fileMeta: UploadFileMeta;
    objectKey: string;
    bucket: string;
    region: string;
    partSize: number;
    updatedAt: number;
    checkpoint: UploadCheckpointData;
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
