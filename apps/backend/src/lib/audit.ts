import { prisma } from './prisma.js';
import { logger } from './logger.js';

/**
 * Write an audit log entry for a sensitive operation. Non-fatal: failures are
 * logged as warnings but never propagate to the caller.
 */
export const audit = async (
  action: string,
  resourceType: string,
  resourceId: string,
  actorId?: string,
  metadata?: Record<string, unknown>
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        actorId: actorId ?? null,
        resourceType,
        resourceId,
        metadata: (metadata ?? {}) as any,
      },
    });
  } catch (err) {
    logger.warn('Audit log write failed (non-fatal):', err);
  }
};
