import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    responseTag: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    responseTagAssignment: {
      upsert: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { error: vi.fn() },
}));

import { prisma } from '../../lib/prisma.js';
import {
  getFormTags,
  createTag,
  deleteTag,
  addTagToResponse,
  removeTagFromResponse,
  getTagsForResponse,
  batchLoadTagsForResponses,
} from '../tagService.js';

beforeEach(() => vi.clearAllMocks());

describe('getFormTags', () => {
  it('returns tags for a form', async () => {
    (prisma.responseTag.findMany as any).mockResolvedValue([{ id: 't1', name: 'Bug' }]);
    const result = await getFormTags('form-1');
    expect(result).toHaveLength(1);
    expect(prisma.responseTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { formId: 'form-1' } })
    );
  });
});

describe('createTag', () => {
  it('upserts tag with default color when color omitted', async () => {
    (prisma.responseTag.upsert as any).mockResolvedValue({ id: 't1' });
    await createTag('form-1', 'Bug');
    expect(prisma.responseTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { color: '#6366f1' },
        create: expect.objectContaining({ color: '#6366f1' }),
      })
    );
  });

  it('upserts tag with provided color', async () => {
    (prisma.responseTag.upsert as any).mockResolvedValue({ id: 't1' });
    await createTag('form-1', 'Feature', '#ff0000');
    expect(prisma.responseTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { color: '#ff0000' },
        create: expect.objectContaining({ color: '#ff0000' }),
      })
    );
  });
});

describe('deleteTag', () => {
  it('returns true when deletion succeeds', async () => {
    (prisma.responseTag.delete as any).mockResolvedValue({});
    const result = await deleteTag('t1');
    expect(result).toBe(true);
  });

  it('returns false when deletion fails', async () => {
    (prisma.responseTag.delete as any).mockRejectedValue(new Error('not found'));
    const result = await deleteTag('missing');
    expect(result).toBe(false);
  });
});

describe('addTagToResponse', () => {
  it('returns true when tag is added successfully', async () => {
    (prisma.responseTagAssignment.upsert as any).mockResolvedValue({});
    const result = await addTagToResponse('r1', 't1');
    expect(result).toBe(true);
  });

  it('returns false when adding fails', async () => {
    (prisma.responseTagAssignment.upsert as any).mockRejectedValue(new Error('db error'));
    const result = await addTagToResponse('r1', 't1');
    expect(result).toBe(false);
  });
});

describe('removeTagFromResponse', () => {
  it('returns true when tag is removed', async () => {
    (prisma.responseTagAssignment.delete as any).mockResolvedValue({});
    const result = await removeTagFromResponse('r1', 't1');
    expect(result).toBe(true);
  });

  it('returns false when removal fails', async () => {
    (prisma.responseTagAssignment.delete as any).mockRejectedValue(new Error('not found'));
    const result = await removeTagFromResponse('r1', 't1');
    expect(result).toBe(false);
  });
});

describe('getTagsForResponse', () => {
  it('returns tags for a response', async () => {
    (prisma.responseTagAssignment.findMany as any).mockResolvedValue([
      { tag: { id: 't1', name: 'Bug' } },
    ]);
    const result = await getTagsForResponse('r1');
    expect(result).toEqual([{ id: 't1', name: 'Bug' }]);
  });
});

describe('batchLoadTagsForResponses', () => {
  it('returns empty object for empty input', async () => {
    const result = await batchLoadTagsForResponses([]);
    expect(result).toEqual({});
    expect(prisma.responseTagAssignment.findMany).not.toHaveBeenCalled();
  });

  it('returns map of responseId to tags', async () => {
    (prisma.responseTagAssignment.findMany as any).mockResolvedValue([
      { responseId: 'r1', tag: { id: 't1', name: 'Bug' } },
      { responseId: 'r2', tag: { id: 't2', name: 'Feature' } },
    ]);
    const result = await batchLoadTagsForResponses(['r1', 'r2', 'r3']);
    expect(result['r1']).toHaveLength(1);
    expect(result['r2']).toHaveLength(1);
    expect(result['r3']).toHaveLength(0);
  });

  it('ignores assignments for responseIds not in the input list', async () => {
    (prisma.responseTagAssignment.findMany as any).mockResolvedValue([
      { responseId: 'r1', tag: { id: 't1', name: 'Bug' } },
      { responseId: 'r-unknown', tag: { id: 't2', name: 'Orphan' } },
    ]);
    const result = await batchLoadTagsForResponses(['r1']);
    expect(result['r1']).toHaveLength(1);
    expect(result['r-unknown']).toBeUndefined();
  });
});
