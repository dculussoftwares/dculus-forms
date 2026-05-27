import './instrument.js';
import { sentryEnabled } from './instrument.js';
import * as Sentry from '@sentry/node';
import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import depthLimit from 'graphql-depth-limit';
import { validate } from 'graphql';
import { toNodeHandler } from 'better-auth/node';
import { auth, DEV_ORIGINS } from './lib/better-auth.js';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { useServer } from 'graphql-ws/use/ws';
import { healthRouter } from './routes/health.js';
import { uploadRouter } from './routes/upload.js';
import { chargebeeWebhookRouter } from './routes/chargebee-webhooks.js';
import { pixabayRouter } from './routes/pixabay.js';
import { pexelsRouter } from './routes/pexels.js';
import { errorHandler } from './middleware/errorHandler.js';
import { edgeGeolocationMiddleware } from './middleware/edge-geolocation.js';
import { createBetterAuthContext } from './middleware/better-auth-middleware.js';
import { prisma } from './lib/prisma.js';
import { createHocuspocusServer } from './services/hocuspocus.js';
import { appConfig } from './lib/env.js';
import { initializePluginSystem } from './plugins/index.js';
import { initializeSubscriptionSystem } from './subscriptions/index.js';
import { startPeriodicCleanup } from './services/temporaryFileService.js';
import { cleanupOldAnalytics } from './services/analyticsService.js';
import { logger } from './lib/logger.js';
import { deriveGraphQLErrorCode } from './lib/graphqlErrors.js';

const app = express();
const httpServer = createServer(app);
const PORT = appConfig.port;

// Holds the graphql-ws dispose function so the shutdown handler can close it cleanly
let disposeGqlWs: (() => void | Promise<void>) | undefined;

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'default-src': [
          "'self'",
          'https://apollo-server-landing-page.cdn.apollographql.com',
          'https://embeddable-sandbox.cdn.apollographql.com',
          'https://sandbox.embed.apollographql.com',
        ],
        // P4-09: unsafe-inline removed from script directives in production.
        // Apollo Studio (which requires it) is disabled in production anyway.
        // Style directives intentionally retain unsafe-inline — removing it
        // requires a nonce-based approach which is out of scope here.
        'script-src': [
          "'self'",
          ...(appConfig.isProduction ? [] : ["'unsafe-inline'", 'https://studio.apollographql.com']),
          'https://apollo-server-landing-page.cdn.apollographql.com',
          'https://embeddable-sandbox.cdn.apollographql.com',
          'https://sandbox.embed.apollographql.com',
        ],
        'script-src-elem': [
          "'self'",
          ...(appConfig.isProduction ? [] : ["'unsafe-inline'", 'https://studio.apollographql.com']),
          'https://apollo-server-landing-page.cdn.apollographql.com',
          'https://embeddable-sandbox.cdn.apollographql.com',
          'https://sandbox.embed.apollographql.com',
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'",
          'https://apollo-server-landing-page.cdn.apollographql.com',
          'https://studio.apollographql.com',
          'https://fonts.googleapis.com',
          'https://sandbox.embed.apollographql.com',
        ],
        'style-src-elem': [
          "'self'",
          "'unsafe-inline'",
          'https://apollo-server-landing-page.cdn.apollographql.com',
          'https://studio.apollographql.com',
          'https://fonts.googleapis.com',
          'https://sandbox.embed.apollographql.com',
        ],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': [
          "'self'",
          'data:',
          'https://apollo-server-landing-page.cdn.apollographql.com',
          'https://studio.apollographql.com',
          'https://sandbox.embed.apollographql.com',
        ],
        'connect-src': [
          "'self'",
          'https://apollo-server-landing-page.cdn.apollographql.com',
          'https://studio.apollographql.com',
          'https://embeddable-sandbox.cdn.apollographql.com',
          'https://sandbox.embed.apollographql.com',
        ],
        'frame-src': [
          "'self'",
          'https://studio.apollographql.com',
          'https://sandbox.embed.apollographql.com',
        ],
        'frame-ancestors': [
          "'self'",
          'https://studio.apollographql.com',
          'https://sandbox.embed.apollographql.com',
        ],
        'manifest-src': [
          "'self'",
          'https://apollo-server-landing-page.cdn.apollographql.com',
        ],
      },
    },
  })
);
// Rate limiters — disabled in test environments so integration/E2E suites are not throttled
const isTestEnv = appConfig.nodeEnv === 'test';

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: isTestEnv ? 10_000 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { error: 'Too many auth requests, please try again later' },
});

const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: isTestEnv ? 10_000 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { error: 'Too many upload requests, please try again later' },
});

const graphqlLimiter = rateLimit({
  windowMs: 60_000,
  max: isTestEnv ? 10_000 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  message: { error: 'Too many requests, please try again later' },
});

const envCorsOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? [];
const apolloStudioOrigins = appConfig.isProduction
  ? []
  : ['https://studio.apollographql.com', 'https://sandbox.embed.apollographql.com'];
const allOrigins = [
  ...new Set([
    ...envCorsOrigins,
    ...(appConfig.isProduction ? [] : DEV_ORIGINS),
    ...apolloStudioOrigins,
  ]),
];

logger.info('🔧 Configured CORS origins:', allOrigins);

// Apply CORS first - this must be before ALL other middleware
app.use(
  cors({
    origin: allOrigins,
    credentials: true,
  })
);

app.use(compression());
// P3-07: Custom Morgan format — logs path without query strings (which may contain tokens)
// and omits client IP to reduce PII in logs. 'combined' format exposed both.
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: { write: (msg: string) => logger.info(msg.trim()) }
}));

// Mount Better Auth handler AFTER CORS middleware — with rate limiting on auth routes
app.all('/api/auth/*', authLimiter, toNodeHandler(auth));

// Apply express.json() AFTER Better Auth handler
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(edgeGeolocationMiddleware);

// graphqlUploadExpress will be added in the async startServer function

// Routes
app.use('/health', healthRouter);
app.use('/', uploadLimiter, uploadRouter);
app.use('/api', chargebeeWebhookRouter);
app.use('/api', pixabayRouter);
app.use('/api', pexelsRouter);

// Add favicon route to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// /debug-sentry intentionally removed — use Sentry CLI or a local test to verify Sentry connectivity

// Sentry Apollo Plugin for GraphQL transaction tracking
const sentryApolloPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation(requestContext: any) {
        const operationName = requestContext.operationName || 'anonymous';
        const operation = requestContext.operation?.operation || 'query';
        Sentry.getCurrentScope().setTransactionName(`GraphQL ${operation}: ${operationName}`);
      },
    };
  },
};

// Build executable schema — shared between ApolloServer (HTTP) and graphql-ws (WebSocket)
const schema = makeExecutableSchema({ typeDefs, resolvers });

// GraphQL Server
const server = new ApolloServer({
  schema,
  introspection: !appConfig.isProduction,
  validationRules: [depthLimit(8)],
  plugins: [
    ...(sentryEnabled ? [sentryApolloPlugin] : []),
    ...(appConfig.isProduction
      ? [ApolloServerPluginLandingPageDisabled()]
      : [ApolloServerPluginLandingPageLocalDefault({
          footer: false,
          includeCookies: true,
          embed: {
            endpointIsEditable: false,
            runTelemetry: false,
            initialState: {
              pollForSchemaUpdates: true,
              sharedHeaders: { 'content-type': 'application/json' },
            },
          },
        })]),
  ],
  formatError: (formattedError, error) => {
    const code = deriveGraphQLErrorCode(formattedError);
    const extensions = {
      ...formattedError.extensions,
      code,
    };

    logger.error('GraphQL Error:', {
      message: formattedError.message,
      path: formattedError.path,
      code,
      originalError: error,
    });

    return {
      ...formattedError,
      extensions,
    };
  },
});

async function startServer() {
  // Initialize plugin system
  logger.info('🔌 Initializing plugin system...');
  initializePluginSystem();
  logger.info('✅ Plugin system initialized');

  // Initialize subscription system
  logger.info('💳 Initializing subscription system...');
  initializeSubscriptionSystem();
  logger.info('✅ Subscription system initialized');

  await server.start();

  // Dynamically import graphql-upload (ESM module)
  const { default: graphqlUploadExpress } = await import(
    'graphql-upload/graphqlUploadExpress.mjs'
  );
  app.use('/graphql', graphqlLimiter);
  app.use(
    '/graphql',
    graphqlUploadExpress({ maxFileSize: 5000000, maxFiles: 10 })
  );

  // Apply Apollo Server middleware
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        const authContext = await createBetterAuthContext(req);
        return {
          user: authContext.user,
          session: authContext.session,
          auth: authContext,
          req, // Add request object for better-auth API calls
          prisma,
        };
      },
    })
  );

  if (sentryEnabled) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use(errorHandler);

  // Create Hocuspocus Server for collaborative editing
  const hocuspocusServer = createHocuspocusServer();

  // Create WebSocket Server and integrate with Hocuspocus
  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/collaboration',
  });

  wss.on('connection', (ws, request) => {
    logger.info('🔌 WebSocket connection established');
    hocuspocusServer.handleConnection(ws, request);
  });

  // GraphQL real-time subscriptions (graphql-ws) — separate path from Hocuspocus
  // NOTE: graphqlLimiter (Express middleware) does not apply to WebSocket connections.
  // The per-org AI token budget in checkAITokenBudget() provides the primary abuse guard
  // for aiChatStream subscriptions. A per-connection rate limit should be added before
  // high-traffic production use.
  const gqlWss = new WebSocketServer({ server: httpServer, path: '/graphql' });
  ({ dispose: disposeGqlWs } = useServer(
    {
      schema,
      validate: (schema, document) => validate(schema, document, [depthLimit(8)]),
      context: async (ctx: { connectionParams?: Record<string, unknown> }) => {
        const token = ctx.connectionParams?.token as string | undefined;
        if (!token) {
          return { auth: { user: null, session: null, isAuthenticated: false } };
        }
        try {
          const headers = new Headers({ authorization: `Bearer ${token}` });
          const sessionData = await auth.api.getSession({ headers });
          return {
            auth: {
              user: sessionData?.user ?? null,
              session: sessionData?.session ?? null,
              isAuthenticated: !!sessionData?.user,
            },
          };
        } catch {
          return { auth: { user: null, session: null, isAuthenticated: false } };
        }
      },
    },
    gqlWss
  ));
  logger.info('🔌 graphql-ws subscription server listening at /graphql');

  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
    logger.info(`📊 GraphQL endpoint: http://localhost:${PORT}/graphql`);
    logger.info(`🤝 Hocuspocus WebSocket server integrated on port ${PORT}`);
    // P3-06: Start periodic 30-min cleanup (also runs immediately on startup)
    startPeriodicCleanup();

    // Run analytics cleanup daily (every 24h)
    setInterval(() => {
      cleanupOldAnalytics().catch(err => logger.warn('Analytics cleanup failed:', err));
    }, 24 * 60 * 60 * 1000).unref(); // .unref() so it doesn't prevent process exit
  });
}

startServer().catch((error) => {
  Sentry.captureException(error);
  logger.error('Failed to start server:', error);
  process.exit(1);
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully`);
  // Dispose graphql-ws server before closing HTTP server
  if (disposeGqlWs) await Promise.resolve(disposeGqlWs()).catch(() => {});
  httpServer.close(async () => {
    try {
      await server.stop();
      await prisma.$disconnect();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
  // Force exit after 15s if graceful shutdown stalls
  setTimeout(() => { logger.error('Forced shutdown after timeout'); process.exit(1); }, 15_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
