import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/better-auth.js';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { healthRouter } from './routes/health.js';
import { formsRouter } from './routes/forms.js';
import { responsesRouter } from './routes/responses.js';
import templatesRouter from './routes/templates.js';
import { uploadRouter } from './routes/upload.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createBetterAuthContext } from './middleware/better-auth-middleware.js';
import { prisma } from './lib/prisma.js';
import { createHocuspocusServer } from './services/hocuspocus.js';
import { appConfig } from './lib/env.js';

const app = express();
const httpServer = createServer(app);
const PORT = appConfig.port;

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
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          'https://apollo-server-landing-page.cdn.apollographql.com',
          'https://studio.apollographql.com',
          'https://embeddable-sandbox.cdn.apollographql.com',
          'https://sandbox.embed.apollographql.com',
        ],
        'script-src-elem': [
          "'self'",
          "'unsafe-inline'",
          'https://apollo-server-landing-page.cdn.apollographql.com',
          'https://studio.apollographql.com',
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
// Parse CORS origins from environment variable
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [
  'http://localhost:3000',
  'http://localhost:3002', // Admin app
  'http://localhost:5173'
];

// Add Apollo Studio domains for GraphQL playground
const allOrigins = [
  ...corsOrigins,
  'https://studio.apollographql.com',
  'https://sandbox.embed.apollographql.com',
];

console.log('🔧 Configured CORS origins:', allOrigins);

// Apply CORS first - this must be before ALL other middleware
app.use(
  cors({
    origin: allOrigins,
    credentials: true,
  })
);

app.use(compression());
app.use(morgan('combined'));

// Mount Better Auth handler AFTER CORS middleware
app.all('/api/auth/*', toNodeHandler(auth));

// Apply express.json() AFTER Better Auth handler
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// graphqlUploadExpress will be added in the async startServer function

// Routes
app.use('/health', healthRouter);
app.use('/api/forms', formsRouter);
app.use('/api/responses', responsesRouter);
app.use('/api/templates', templatesRouter);
app.use('/', uploadRouter);

// Add favicon route to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// GraphQL Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true, // Enable introspection for Apollo Studio Sandbox
  plugins: [
    // Use the modern Apollo Studio Sandbox (embedded) for development
    ApolloServerPluginLandingPageLocalDefault({
      footer: false,
      includeCookies: true,
      embed: {
        endpointIsEditable: false,
        runTelemetry: false,
        initialState: {
          pollForSchemaUpdates: true,
          sharedHeaders: {
            'content-type': 'application/json',
          },
        },
      },
    }),
  ],
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return {
      message: error.message,
      path: error.path,
    };
  },
});

async function startServer() {
  await server.start();

  // Dynamically import graphql-upload (ESM module)
  const { default: graphqlUploadExpress } = await import(
    'graphql-upload/graphqlUploadExpress.mjs'
  );
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
    console.log('🔌 WebSocket connection established');
    hocuspocusServer.handleConnection(ws, request);
  });

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 GraphQL endpoint: http://localhost:${PORT}/graphql`);
    console.log(`🤝 Hocuspocus WebSocket server integrated on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
