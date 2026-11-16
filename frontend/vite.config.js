import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cspHashPlugin } from './scripts/cspHashPlugin.js';

const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000';

// ARCHITECTURE.md §1 — dev ortamında prod'daki aynı-origin düzenini taklit eder.
export default defineConfig({
  plugins: [react(), tailwindcss(), cspHashPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/media': { target: API_TARGET, changeOrigin: false },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
