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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@apollo') || id.includes('/graphql/')) return 'vendor-apollo';
          if (id.includes('better-auth')) return 'vendor-auth';
          if (id.includes('@radix-ui')) return 'vendor-radix';
        },
      },
    },
  },
  server: {
    port: 3002,
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