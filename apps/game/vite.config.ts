import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    // The preview environment proxies through a generated host header,
    // so we need to allow any host rather than the strict default.
    allowedHosts: true,
    cors: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
