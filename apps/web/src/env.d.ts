/// <reference types="vite/client" />

/** Vite 环境变量类型（与 .env / .env.example 对齐） */
interface ImportMetaEnv {
  /** 站点标题 */
  readonly VITE_APP_TITLE?: string;
  /** 后端接口基础地址，默认 /api（走 vite 代理） */
  readonly VITE_API_BASE?: string;
  /** Socket.IO 连接地址，留空则同源 */
  readonly VITE_WS_URL?: string;
  /** 接口签名密钥，需与后端 SIGN_KEY 一致 */
  readonly VITE_SIGN_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
