import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { appConfig } from './lib/env.js';

const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  const isProd = appConfig.isProduction;
  const tracesSampleRate = isProd ? 0.1 : 1.0;
  const profilingSampleRate = isProd ? 0.05 : 1.0;

  Sentry.init({
    dsn: sentryDsn,
    environment: appConfig.nodeEnv,
    sendDefaultPii: true,
    // Capture fewer transactions in production to limit noise
    tracesSampleRate,
    profileSessionSampleRate: profilingSampleRate,
    profileLifecycle: 'trace',
    integrations: [
      Sentry.expressIntegration(),
      nodeProfilingIntegration(),
      Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
    ],
    enableLogs: true,
  });
} else if (appConfig.isDevelopment) {
  console.warn('Sentry DSN not provided; error monitoring is disabled.');
}

export const sentryEnabled = Boolean(sentryDsn);
