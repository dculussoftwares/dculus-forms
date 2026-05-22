import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getFormById } from '../../services/formService.js';
import {
  getResponseById,
  getAllResponsesByFormId,
} from '../../services/responseService.js';
import { sendEmail, type EmailOptions } from '../../services/emailService.js';
import { logger } from '../../lib/logger.js';

export interface PluginContext {
  prisma: PrismaClient;
  getFormById: typeof getFormById;
  getResponseById: typeof getResponseById;
  getResponsesByFormId: typeof getAllResponsesByFormId;
  getOrganization: (orgId: string) => Promise<any>;
  getUserById: (userId: string) => Promise<any>;
  sendEmail: (options: EmailOptions) => Promise<void>;
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}

export const createPluginContext = (): PluginContext => ({
  prisma,
  getFormById,
  getResponseById,
  getResponsesByFormId: getAllResponsesByFormId,

  getOrganization: (orgId: string) =>
    prisma.organization.findUnique({
      where: { id: orgId },
      include: { members: { include: { user: true } } },
    }),

  getUserById: (userId: string) =>
    prisma.user.findUnique({ where: { id: userId } }),

  sendEmail,

  logger: {
    info: (message, meta?) => logger.info(`[Plugin] ${message}`, meta ?? ''),
    error: (message, error?) => logger.error(`[Plugin Error] ${message}`, error ?? ''),
    warn: (message, meta?) => logger.warn(`[Plugin Warning] ${message}`, meta ?? ''),
  },
});
