import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8080';

  // dev 与 preview 共用同一套代理：preview 用于验收构建产物，必须也能访问 /api
  const proxy = {
    // 用 vite 代理解决跨域，而不是让后端开 CORS
    '/api': {
      target: apiTarget,
      changeOrigin: true,
    },
    // Socket.IO 的握手/升级走 engine.io 默认路径 /socket.io/（namespace 才是 /ws，不走 URL）
    '/socket.io': {
      target: apiTarget,
      changeOrigin: true,
      ws: true,
    },
    '/static': {
      target: apiTarget,
      changeOrigin: true,
    },
  };

  return {
    plugins: [
      vue(),
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia'],
        resolvers: [ElementPlusResolver()],
        dts: 'src/types/auto-imports.d.ts',
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'src/types/components.d.ts',
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy,
    },
    preview: {
      port: 4173,
      host: '0.0.0.0',
      proxy,
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            element: ['element-plus', '@element-plus/icons-vue'],
            three: ['three'],
            echarts: ['echarts'],
          },
        },
      },
    },
  };
});
