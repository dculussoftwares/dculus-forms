import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Test against workspace sources so a stale dist/ can never skew results
    alias: {
      '@dculus/types': path.resolve(__dirname, '../types/src/index.ts'),
      '@dculus/utils': path.resolve(__dirname, '../utils/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
