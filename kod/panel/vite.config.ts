import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Panel: static SPA served by kezjegy-web (:8081) behind Caddy on konyvelo.<host>; the API is same-origin /api/v1
// (SPEC §3.1). In `npm run dev` /api is proxied to a local backend (VITE_API_PROXY, default http://localhost:8080).
// `--mode mock` (.env.mock) turns on the in-browser demo API (src/mock) - never part of a normal build.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react()],
    base: '/',
    server: {
      port: 5174,
      proxy: { '/api': { target: env.VITE_API_PROXY || 'http://localhost:8080', changeOrigin: false } },
    },
    preview: { port: 4319 },
    build: {
      target: 'es2022',
      sourcemap: false,
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 900,
    },
  };
});
