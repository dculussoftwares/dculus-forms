import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createResponseFileExportRepository } from '../responseFileExportRepository.js';

describe('ResponseFileExport Repository', () => {
  const mockPrisma = {
    responseFileExport: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  };
  let repository: ReturnType<typeof createResponseFileExportRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createResponseFileExportRepository({ prisma: mockPrisma as any });
  });

  it('creates, reads and updates export rows', async () => {
    const data = { formId: 'f1', requestedById: 'u1', status: 'running', grouping: 'question', totalCount: 2 };
    await repository.create(data);
    expect(mockPrisma.responseFileExport.create).toHaveBeenCalledWith({ data });

    await repository.findById('e1');
    expect(mockPrisma.responseFileExport.findUnique).toHaveBeenCalledWith({ where: { id: 'e1' } });

    await repository.update('e1', { status: 'completed' });
    expect(mockPrisma.responseFileExport.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { status: 'completed' } });
  });

  it('only updates a job that is still running', async () => {
    mockPrisma.responseFileExport.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await expect(repository.updateIfRunning('e1', { status: 'completed' })).resolves.toBe(true);
    await expect(repository.updateIfRunning('e1', { status: 'completed' })).resolves.toBe(false);
    expect(mockPrisma.responseFileExport.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', status: 'running' },
      data: { status: 'completed' },
    });
  });

  it('counts a requester’s recent exports for rate limiting', async () => {
    const since = new Date('2026-10-09T00:00:00Z');
    mockPrisma.responseFileExport.count.mockResolvedValue(3);

    await expect(repository.countByRequesterSince('u1', since)).resolves.toBe(3);
    expect(mockPrisma.responseFileExport.count).toHaveBeenCalledWith({
      where: { requestedById: 'u1', createdAt: { gte: since } },
    });
  });

  it('finds the requester’s running export for a form', async () => {
    await repository.findRunning('f1', 'u1');
    expect(mockPrisma.responseFileExport.findFirst).toHaveBeenCalledWith({
      where: { formId: 'f1', requestedById: 'u1', status: 'running' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
