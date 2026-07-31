import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for AuditLog data access. Append-only from every current call
 * site (`admin.ts`'s 7 `auditLog.create` calls) — no read path exists
 * anywhere in the codebase today, so only `create` is exposed.
 */
export const createAuditLogRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const create = <T extends Prisma.AuditLogCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AuditLogCreateArgs>
  ) => prisma.auditLog.create(args);

  /** --- Domain-oriented helpers for common access patterns --- */

  /**
   * Write a single audit log entry. Unguarded — callers that want a
   * non-fatal write (failures logged but swallowed) should use
   * `lib/audit.ts`'s `audit()` helper instead.
   */
  const logAction = async (data: Prisma.AuditLogCreateArgs['data']) =>
    prisma.auditLog.create({ data });

  return {
    // Generic operations (used when custom queries are needed)
    create,

    // Domain helpers (preferred for service layer)
    logAction,
  };
};

export type AuditLogRepository = ReturnType<typeof createAuditLogRepository>;

export const auditLogRepository = createAuditLogRepository();
