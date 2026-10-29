import type { Hocuspocus } from '@hocuspocus/server';
import { logger } from '../lib/logger.js';

// Kept separate from hocuspocus.ts so resolvers/services can reach the running
// server without an import cycle (hocuspocus.ts imports the sharing resolvers).
let hocuspocusServer: Hocuspocus | null = null;

export const registerHocuspocusServer = (server: Hocuspocus): void => {
  hocuspocusServer = server;
};

/**
 * S13-01: drops every live collaboration socket for a form so each client must
 * re-run onAuthenticate (and so pick up changed/revoked permissions) to rejoin.
 * A no-op when no server is running (tests, CLI scripts).
 */
export const closeFormCollaborationConnections = (formId: string): void => {
  try {
    hocuspocusServer?.closeConnections(formId);
  } catch (error) {
    logger.error(`[Hocuspocus] Failed to close connections for ${formId}:`, error);
  }
};
