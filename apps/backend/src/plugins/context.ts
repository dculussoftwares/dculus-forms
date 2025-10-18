import type { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getFormById } from '../services/formService.js';
import {
  getResponseById,
  getAllResponsesByFormId,
} from '../services/responseService.js';
import { sendEmail, type EmailOptions } from '../services/emailService.js';

/**
 * Plugin context interface
 * Provides helper functions to all plugin handlers
 */
export interface PluginContext {
  // Database access
  prisma: PrismaClient;

  // Service helpers (pre-bound functions)
  getFormById: typeof getFormById;
  getResponseById: typeof getResponseById;
  getResponsesByFormId: typeof getAllResponsesByFormId;

  // Organization helpers
  getOrganization: (orgId: string) => Promise<any>;

  // User helpers
  getUserById: (userId: string) => Promise<any>;

  // Email helper
  sendEmail: (options: EmailOptions) => Promise<void>;

  // Logger (automatically prefixed with [Plugin])
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}

/**
 * Create plugin context with helper functions
 * This context is injected into every plugin handler
 *
 * @returns PluginContext with all helper functions
 */
export const createPluginContext = (): PluginContext => {
  return {
    // Direct prisma access for advanced queries
    prisma,

    // Pre-bound service functions
    getFormById,
    getResponseById,
    getResponsesByFormId: getAllResponsesByFormId,

    // Organization helper
    getOrganization: async (orgId: string) => {
      return await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });
    },

    // User helper
    getUserById: async (userId: string) => {
      return await prisma.user.findUnique({
        where: { id: userId },
      });
    },

    // Email helper
    sendEmail,

    // Logger with plugin context prefix
    logger: {
      info: (message: string, meta?: any) => {
        console.log(`[Plugin] ${message}`, meta || '');
      },
      error: (message: string, error?: any) => {
        console.error(`[Plugin Error] ${message}`, error || '');
      },
      warn: (message: string, meta?: any) => {
        console.warn(`[Plugin Warning] ${message}`, meta || '');
      },
    },
  };
};
