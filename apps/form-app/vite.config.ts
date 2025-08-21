import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@dculus/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@dculus/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@dculus/types': path.resolve(__dirname, '../../packages/types/src/index'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/graphql': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
}); 