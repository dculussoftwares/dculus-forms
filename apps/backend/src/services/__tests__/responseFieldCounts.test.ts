import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  countResponsesPerField,
  countResponsesReferencingAnyField,
} from '../responseService.js';
import { prisma } from '../../lib/prisma.js';

vi.mock('../../repositories/index.js', () => ({ responseRepository: {} }));
vi.mock('../responseFilterService.js', () => ({ applyResponseFilters: vi.fn() }));
vi.mock('../responseEditTrackingService.js', () => ({ ResponseEditTrackingService: {} }));
vi.mock('../tagService.js', () => ({ batchLoadTagsForResponses: vi.fn() }));
vi.mock('../../lib/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn() },
}));

describe('countResponsesPerField', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 0 for every requested field id, then overlays query counts', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { field_id: 'f-1', count: BigInt(42) },
      { field_id: 'f-3', count: BigInt(5) },
    ] as any);

    const result = await countResponsesPerField('form-1', ['f-1', 'f-2', 'f-3']);
    expect(result).toEqual({ 'f-1': 42, 'f-2': 0, 'f-3': 5 });
  });

  it('short-circuits with an empty map when no field ids are given (no query)', async () => {
    const result = await countResponsesPerField('form-1', []);
    expect(result).toEqual({});
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns all-zero counts and logs when the query throws', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('db down'));
    const result = await countResponsesPerField('form-1', ['f-1', 'f-2']);
    expect(result).toEqual({ 'f-1': 0, 'f-2': 0 });
  });
});

describe('countResponsesReferencingAnyField', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the distinct response count from the query', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ count: BigInt(7) }] as any);
    const result = await countResponsesReferencingAnyField('form-1', ['f-1', 'f-2']);
    expect(result).toBe(7);
  });

  it('returns 0 when no field ids are given (no query)', async () => {
    const result = await countResponsesReferencingAnyField('form-1', []);
    expect(result).toBe(0);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns 0 when the query returns no rows', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([] as any);
    const result = await countResponsesReferencingAnyField('form-1', ['f-1']);
    expect(result).toBe(0);
  });

  it('returns 0 and logs when the query throws', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('db down'));
    const result = await countResponsesReferencingAnyField('form-1', ['f-1']);
    expect(result).toBe(0);
  });
});
