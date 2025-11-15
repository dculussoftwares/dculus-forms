declare module '@sentry/profiling-node' {
  import type { Integration } from '@sentry/core';

  export function nodeProfilingIntegration(): Integration;
}
