import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    responseTag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    responseTagAssignment: {
      upsert: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    response: {
      deleteMany: vi.fn(),
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
  upsertPreviewTag,
  deletePreviewResponses,
  upsertAiGeneratedTag,
  deleteAiGeneratedResponses,
  PREVIEW_TAG_NAME,
  AI_GENERATED_TAG_NAME,
  AI_GENERATED_RESPONSE_SOURCE,
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

describe('upsertPreviewTag', () => {
  it('upserts tag with preview name and amber color', async () => {
    const tag = { id: 'preview-tag', name: PREVIEW_TAG_NAME, color: '#f59e0b' };
    (prisma.responseTag.upsert as any).mockResolvedValue(tag);

    const result = await upsertPreviewTag('form-1');

    expect(prisma.responseTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formId_name: { formId: 'form-1', name: PREVIEW_TAG_NAME } },
        create: expect.objectContaining({ name: PREVIEW_TAG_NAME, color: '#f59e0b' }),
      })
    );
    expect(result).toEqual(tag);
  });
});

describe('deletePreviewResponses', () => {
  it('returns 0 when no preview tag exists for the form', async () => {
    (prisma.responseTag.findFirst as any).mockResolvedValue(null);

    const count = await deletePreviewResponses('form-1');

    expect(count).toBe(0);
    expect(prisma.responseTagAssignment.findMany).not.toHaveBeenCalled();
  });

  it('returns 0 when the preview tag has no assignments', async () => {
    (prisma.responseTag.findFirst as any).mockResolvedValue({ id: 'tag-1' });
    (prisma.responseTagAssignment.findMany as any).mockResolvedValue([]);

    const count = await deletePreviewResponses('form-1');

    expect(count).toBe(0);
    expect(prisma.response.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes responses assigned to the preview tag and returns count', async () => {
    (prisma.responseTag.findFirst as any).mockResolvedValue({ id: 'tag-1' });
    (prisma.responseTagAssignment.findMany as any).mockResolvedValue([
      { responseId: 'r1' },
      { responseId: 'r2' },
    ]);
    (prisma.response.deleteMany as any).mockResolvedValue({ count: 2 });

    const count = await deletePreviewResponses('form-1');

    expect(prisma.response.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['r1', 'r2'] } },
    });
    expect(count).toBe(2);
  });
});

describe('upsertAiGeneratedTag', () => {
  it('upserts tag with AI-generated name and violet color', async () => {
    const tag = { id: 'ai-tag', name: AI_GENERATED_TAG_NAME, color: '#8b5cf6' };
    (prisma.responseTag.upsert as any).mockResolvedValue(tag);

    const result = await upsertAiGeneratedTag('form-1');

    expect(prisma.responseTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formId_name: { formId: 'form-1', name: AI_GENERATED_TAG_NAME } },
        create: expect.objectContaining({ name: AI_GENERATED_TAG_NAME, color: '#8b5cf6' }),
      })
    );
    expect(result).toEqual(tag);
  });
});

describe('deleteAiGeneratedResponses', () => {
  it('deletes by formId + metadata.source, independent of tag assignments', async () => {
    (prisma.response.deleteMany as any).mockResolvedValue({ count: 3 });

    const count = await deleteAiGeneratedResponses('form-1');

    expect(prisma.response.deleteMany).toHaveBeenCalledWith({
      where: {
        formId: 'form-1',
        metadata: { path: ['source'], equals: AI_GENERATED_RESPONSE_SOURCE },
      },
    });
    expect(prisma.responseTag.findFirst).not.toHaveBeenCalled();
    expect(count).toBe(3);
  });

  it('returns 0 when no matching responses exist', async () => {
    (prisma.response.deleteMany as any).mockResolvedValue({ count: 0 });

    const count = await deleteAiGeneratedResponses('form-1');

    expect(count).toBe(0);
  });
});
