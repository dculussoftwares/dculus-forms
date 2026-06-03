import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Use a single fork to avoid timeout when running in parallel with other
    // vitest instances (e.g. backend tests in the pre-push hook)
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
