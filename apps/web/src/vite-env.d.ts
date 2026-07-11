/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_SHOW_REAL_MEET_LINK?: string;
  readonly VITE_ENABLE_ADMIN_FEATURES?: string;
  readonly VITE_ENABLE_TEACHER_FEATURES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
