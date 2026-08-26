import type { PrismaClient } from '#prisma-client';
import { prisma } from '../../lib/prisma.js';
import { getFormById } from '../../services/formService.js';
import {
  getResponseById,
  getAllResponsesByFormId,
} from '../../services/responseService.js';
import { sendEmail, type EmailOptions } from '../../services/emailService.js';
import { logger } from '../../lib/logger.js';
import type { PluginConfig } from './types.js';

export interface PluginContext {
  prisma: PrismaClient;
  getFormById: typeof getFormById;
  getResponseById: typeof getResponseById;
  getResponsesByFormId: typeof getAllResponsesByFormId;
  getOrganization: (orgId: string) => Promise<any>;
  getUserById: (userId: string) => Promise<any>;
  sendEmail: (options: EmailOptions) => Promise<void>;
  /**
   * Persists an updated config for the plugin/action node currently being executed (e.g. a
   * refreshed OAuth token, or an auto-created spreadsheet/workbook ID) — the durable-storage
   * equivalent of "save this back to wherever my config actually lives."
   *
   * Handlers must go through this instead of writing `context.prisma.formPlugin.update(...)`
   * directly: the legacy standalone Plugins system backs each plugin with a real `FormPlugin`
   * row, but the Automations system has no such row — action-node config lives inline inside
   * `Automation.graph`'s JSON — so a handler that assumes a `FormPlugin` row always exists
   * throws "record not found" the moment it runs inside an automation (see google-sheets and
   * microsoft-sheets handlers). Each caller of `createPluginContext` supplies the persistence
   * strategy appropriate to how it invoked the handler (see `executor.ts` vs
   * `services/automation/engine.ts`).
   */
  updatePluginConfig: (config: PluginConfig) => Promise<void>;
  /**
   * A key identifying *this delivery* that stays the same across every retry of it, for handlers
   * that talk to a system able to deduplicate on one.
   *
   * Action nodes retry (3× with backoff) on any error, and an error is not proof the far side did
   * nothing: a webhook that timed out after the receiver committed its work is retried, and the
   * receiver sees the same submission twice. Forwarding a stable key lets it recognise the repeat.
   * It is deliberately per-delivery, not per-run — the same run retrying the same node must reuse
   * the key, while a different node or a different run must not.
   *
   * Undefined when the caller has no stable identity to offer, so handlers must treat it as
   * optional rather than assume it is always present.
   */
  idempotencyKey?: string;
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}

export const createPluginContext = (
  updatePluginConfig: (config: PluginConfig) => Promise<void> = async () => {
    throw new Error(
      'updatePluginConfig was not configured for this PluginContext — the caller of createPluginContext() must supply a persistence strategy before invoking a handler that calls it'
    );
  },
  idempotencyKey?: string
): PluginContext => ({
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

  updatePluginConfig,

  idempotencyKey,

  logger: {
    info: (message, meta?) => logger.info(`[Plugin] ${message}`, meta ?? ''),
    error: (message, error?) => logger.error(`[Plugin Error] ${message}`, error ?? ''),
    warn: (message, meta?) => logger.warn(`[Plugin Warning] ${message}`, meta ?? ''),
  },
});
