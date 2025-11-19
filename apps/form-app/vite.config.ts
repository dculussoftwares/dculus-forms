import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@dculus/ui', replacement: path.resolve(__dirname, '../../packages/ui/src') },
      { find: '@dculus/utils', replacement: path.resolve(__dirname, '../../packages/utils/src') },
      {
        find: '@dculus/types/graphql',
        replacement: path.resolve(__dirname, '../../packages/types/src/graphql.ts'),
      },
      {
        find: '@dculus/types',
        replacement: path.resolve(__dirname, '../../packages/types/src/index.ts'),
      },
    ],
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
