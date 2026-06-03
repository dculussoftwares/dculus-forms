import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Use a single vmThread (worker thread, no child process) to avoid fork
    // startup timeouts when running alongside other vitest instances in the
    // pre-push hook (backend tests + type-check run in parallel).
    pool: 'vmThreads',
    poolOptions: {
      vmThreads: { singleThread: true },
    },
  },
});
