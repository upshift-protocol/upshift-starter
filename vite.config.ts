import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'import.meta.env.CI': JSON.stringify(process.env.CI ?? ''),
    'import.meta.env.VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV ?? ''),
  },
  build: { commonjsOptions: { defaultIsModuleExports: true } },
  server: {
    proxy: {
      '/api/august': {
        target: 'https://api.augustdigital.io/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/august/, ''),
      },
    },
  },
});
