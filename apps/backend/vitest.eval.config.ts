import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

// Live-model evals: real provider calls, so they are opt-in (`pnpm --filter backend eval:ai`)
// and never part of `pnpm test`. Each case is graded on its tool calls and reply format.
// Standalone (not mergeConfig) because merging would concatenate `include` with the unit tests.
export default defineConfig({
  resolve: baseConfig.resolve,
  test: {
    globals: true,
    environment: 'node',
    include: ['src/evals/**/*.live.eval.ts'],
    setupFiles: ['dotenv/config', './test/setup.ts'],
    testTimeout: 120_000,
    // One provider call chain at a time keeps results readable and avoids rate limits.
    fileParallelism: false,
  },
});
