/// <reference types="vite/client" />

// Доп. типы для пользовательских VITE_* env-переменных,
// чтобы TS-компилятор не ругался при обращении к import.meta.env.
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_WS_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
