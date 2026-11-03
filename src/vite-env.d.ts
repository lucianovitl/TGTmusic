/// <reference types="vite/client" />
/// <reference types="@tauri-apps/api" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_TAURI_PLATFORM: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}