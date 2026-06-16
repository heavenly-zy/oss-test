/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_S3_BUCKET?: string;
  readonly VITE_S3_REGION?: string;
  readonly VITE_S3_ENDPOINT?: string;
  readonly VITE_S3_BASE_PATH?: string;
  readonly VITE_S3_PUBLIC_BASE_URL?: string;
  readonly VITE_S3_FORCE_PATH_STYLE?: string;
  readonly VITE_S3_STS_TOKEN_URL?: string;
  readonly VITE_S3_PART_SIZE_MB?: string;
  readonly VITE_S3_MULTIPART_THRESHOLD_MB?: string;
  readonly VITE_S3_CONCURRENCY?: string;
  readonly VITE_S3_SIGN_URL_EXPIRE_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
