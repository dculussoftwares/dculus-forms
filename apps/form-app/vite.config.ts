import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { pdfmeWorkerAssetFallbackPlugin } from './vite-pdfme-worker-fallback';

export default defineConfig({
  plugins: [react(), pdfmeWorkerAssetFallbackPlugin()],
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
        find: '@dculus/types/quiz.js',
        replacement: path.resolve(__dirname, '../../packages/types/src/quiz.ts'),
      },
      {
        find: '@dculus/types/quiz',
        replacement: path.resolve(__dirname, '../../packages/types/src/quiz.ts'),
      },
      {
        find: '@dculus/types/embed.js',
        replacement: path.resolve(__dirname, '../../packages/types/src/embed.ts'),
      },
      {
        find: '@dculus/types/embed',
        replacement: path.resolve(__dirname, '../../packages/types/src/embed.ts'),
      },
      {
        find: '@dculus/types',
        replacement: path.resolve(__dirname, '../../packages/types/src/index.ts'),
      },
      {
        find: '@dculus/plugins',
        replacement: path.resolve(__dirname, '../../packages/plugins/src/index.ts'),
      },
    ],
  },
  build: {
    // The pdfme designer (@pdfme/ui, @pdfme/schemas) is lazy-loaded via
    // React.lazy() in App.tsx and never lands in the initial page load, so
    // its large chunk size doesn't affect load performance — raise the limit
    // to stop Rollup warning about it.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // P2-20: Split heavy third-party libraries into named chunks to improve
        // caching and reduce initial bundle size.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('yjs')) return 'vendor-yjs';
          if (id.includes('recharts')) return 'vendor-recharts';
          if (id.includes('@apollo') || id.includes('/graphql/')) return 'vendor-apollo';
          if (id.includes('@sentry')) return 'vendor-sentry';
          if (id.includes('better-auth')) return 'vendor-auth';
          if (id.includes('@dnd-kit')) return 'vendor-dnd-kit';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('@pdfme')) return 'vendor-pdfme';
          if (id.includes('@xyflow') || id.includes('@dagrejs')) return 'vendor-flow';
          if (id.includes('@ai-sdk') || id.match(/[\\/]ai[\\/]/)) return 'vendor-ai';
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('mdast') || id.includes('micromark') || id.includes('unified') || id.includes('hast')) return 'vendor-markdown';
        },
      },
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
