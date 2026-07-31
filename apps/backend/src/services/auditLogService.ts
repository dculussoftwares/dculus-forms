import type { Prisma } from '#prisma-client';
import { auditLogRepository } from '../repositories/auditLogRepository.js';

/**
 * Audit Log Service
 * Thin, unguarded wrapper over auditLogRepository for `admin.ts`'s
 * sensitive-operation logging. Deliberately does not catch/swallow errors —
 * matches the existing (pre-refactor) behavior where a failed audit log
 * write fails the enclosing mutation. Callers that want a non-fatal write
 * should use `lib/audit.ts`'s `audit()` helper instead.
 */
export const logAction = async (data: Prisma.AuditLogCreateArgs['data']) =>
  auditLogRepository.logAction(data);
