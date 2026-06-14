/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OSS_REGION: string;
  readonly VITE_OSS_BUCKET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}