/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_APP_API_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
