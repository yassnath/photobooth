/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QRIS_PAYLOAD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
