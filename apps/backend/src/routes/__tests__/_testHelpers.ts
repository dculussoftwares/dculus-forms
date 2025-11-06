import express, { Express } from 'express';
import { errorHandler } from '../../middleware/errorHandler.js';

/**
 * Creates a test Express app with error handling middleware
 */
export function createTestApp(router: express.Router, routePath: string): Express {
  const app = express();
  app.use(express.json());
  app.use(routePath, router);
  // Add error handler middleware
  app.use(errorHandler);
  return app;
}
