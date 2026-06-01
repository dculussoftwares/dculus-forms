import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma.js', () => ({
  prisma: { auditLog: { create: vi.fn() } },
}));
vi.mock('../logger.js', () => ({
  logger: { warn: vi.fn() },
}));

import { prisma } from '../prisma.js';
import { audit } from '../audit.js';

beforeEach(() => vi.clearAllMocks());

describe('audit', () => {
  it('creates an audit log entry', async () => {
    (prisma.auditLog.create as any).mockResolvedValue({});
    await audit('FORM_CREATED', 'Form', 'form-1', 'user-1', { key: 'val' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'FORM_CREATED' }) })
    );
  });

  it('does not throw when prisma write fails', async () => {
    (prisma.auditLog.create as any).mockRejectedValue(new Error('db error'));
    await expect(audit('FORM_DELETED', 'Form', 'form-1')).resolves.toBeUndefined();
  });

  it('uses null for missing actorId and empty metadata', async () => {
    (prisma.auditLog.create as any).mockResolvedValue({});
    await audit('ACTION', 'Type', 'id-1');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorId: null, metadata: {} }) })
    );
  });
});
