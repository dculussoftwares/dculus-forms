/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Library build: the renderer, the @dculus/* source it needs and their
// dependencies are bundled into one ES module. Only React stays external,
// so the host app's React (18 or 19) is the one that runs.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@dculus/ui', replacement: resolve(__dirname, '../ui/src') },
      { find: '@dculus/utils', replacement: resolve(__dirname, '../utils/src') },
      { find: '@dculus/types/graphql.js', replacement: resolve(__dirname, '../types/src/graphql.ts') },
      { find: '@dculus/types/graphql', replacement: resolve(__dirname, '../types/src/graphql.ts') },
      { find: '@dculus/types', replacement: resolve(__dirname, '../types/src/index.ts') },
    ],
  },
  // Bundled deps read process.env.NODE_ENV; pin it for the published build only.
  define: mode === 'test' ? {} : { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: false,
  },
}));
