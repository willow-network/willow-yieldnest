import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/willow-api': {
        target: 'http://127.0.0.1:3031',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/willow-api/, ''),
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
