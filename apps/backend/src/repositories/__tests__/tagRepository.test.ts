import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Prisma } from '#prisma-client';
import { createTagRepository } from '../tagRepository.js';

const prismaMock = vi.hoisted(() => ({
  responseTag: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  responseTagAssignment: {
    findMany: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

vi.mock('../baseRepository.js', () => ({
  resolvePrisma: () => prismaMock,
}));

describe('tagRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.responseTag.findMany.mockResolvedValue([]);
    prismaMock.responseTag.findFirst.mockResolvedValue(null);
    prismaMock.responseTag.upsert.mockResolvedValue({});
    prismaMock.responseTag.delete.mockResolvedValue({});
    prismaMock.responseTagAssignment.findMany.mockResolvedValue([]);
    prismaMock.responseTagAssignment.upsert.mockResolvedValue({});
    prismaMock.responseTagAssignment.delete.mockResolvedValue({});
    prismaMock.responseTagAssignment.createMany.mockResolvedValue({ count: 0 });
  });

  it('should proxy basic prisma delegate methods', async () => {
    const repo = createTagRepository();
    const args = { where: { id: 'tag-1' } };

    await repo.findMany(args satisfies Prisma.ResponseTagFindManyArgs);
    await repo.findFirst(args satisfies Prisma.ResponseTagFindFirstArgs);
    await repo.upsert({
      where: { id: 'tag-1' },
      create: { formId: 'form-1', name: 'tag' },
      update: {},
    } satisfies Prisma.ResponseTagUpsertArgs);
    await repo.delete({ where: { id: 'tag-1' } } satisfies Prisma.ResponseTagDeleteArgs);
    await repo.findManyAssignments({
      where: { responseId: 'r-1' },
    } satisfies Prisma.ResponseTagAssignmentFindManyArgs);
    await repo.upsertAssignment({
      where: { responseId_tagId: { responseId: 'r-1', tagId: 't-1' } },
      create: { responseId: 'r-1', tagId: 't-1' },
      update: {},
    } satisfies Prisma.ResponseTagAssignmentUpsertArgs);
    await repo.deleteAssignment({
      where: { responseId_tagId: { responseId: 'r-1', tagId: 't-1' } },
    } satisfies Prisma.ResponseTagAssignmentDeleteArgs);
    await repo.createMany({
      data: [{ responseId: 'r-1', tagId: 't-1' }],
    } satisfies Prisma.ResponseTagAssignmentCreateManyArgs);

    expect(prismaMock.responseTag.findMany).toHaveBeenCalledWith(args);
    expect(prismaMock.responseTag.findFirst).toHaveBeenCalledWith(args);
    expect(prismaMock.responseTag.upsert).toHaveBeenCalled();
    expect(prismaMock.responseTag.delete).toHaveBeenCalled();
    expect(prismaMock.responseTagAssignment.findMany).toHaveBeenCalled();
    expect(prismaMock.responseTagAssignment.upsert).toHaveBeenCalled();
    expect(prismaMock.responseTagAssignment.delete).toHaveBeenCalled();
    expect(prismaMock.responseTagAssignment.createMany).toHaveBeenCalled();
  });

  it('should expose domain helpers', async () => {
    const repo = createTagRepository();

    await repo.listByForm('form-1');
    expect(prismaMock.responseTag.findMany).toHaveBeenCalledWith({
      where: { formId: 'form-1' },
      orderBy: { createdAt: 'asc' },
    });

    await repo.upsertTag('form-1', 'important', '#ff0000');
    expect(prismaMock.responseTag.upsert).toHaveBeenCalledWith({
      where: { formId_name: { formId: 'form-1', name: 'important' } },
      update: { color: '#ff0000' },
      create: { formId: 'form-1', name: 'important', color: '#ff0000' },
    });

    await repo.upsertTag('form-1', 'important');
    expect(prismaMock.responseTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { color: '#6366f1' },
        create: { formId: 'form-1', name: 'important', color: '#6366f1' },
      })
    );

    await repo.ensureTag('form-1', '__preview__', '#f59e0b');
    expect(prismaMock.responseTag.upsert).toHaveBeenCalledWith({
      where: { formId_name: { formId: 'form-1', name: '__preview__' } },
      update: {},
      create: { formId: 'form-1', name: '__preview__', color: '#f59e0b' },
    });

    await repo.findByFormAndName('form-1', 'important');
    expect(prismaMock.responseTag.findFirst).toHaveBeenCalledWith({
      where: { formId: 'form-1', name: 'important' },
    });

    await repo.assignTag('resp-1', 'tag-1');
    expect(prismaMock.responseTagAssignment.upsert).toHaveBeenCalledWith({
      where: { responseId_tagId: { responseId: 'resp-1', tagId: 'tag-1' } },
      update: {},
      create: { responseId: 'resp-1', tagId: 'tag-1' },
    });

    await repo.unassignTag('resp-1', 'tag-1');
    expect(prismaMock.responseTagAssignment.delete).toHaveBeenCalledWith({
      where: { responseId_tagId: { responseId: 'resp-1', tagId: 'tag-1' } },
    });

    await repo.findAssignmentsByResponse('resp-1');
    expect(prismaMock.responseTagAssignment.findMany).toHaveBeenCalledWith({
      where: { responseId: 'resp-1' },
      include: { tag: true },
    });

    await repo.findAssignmentsByResponses(['resp-1', 'resp-2']);
    expect(prismaMock.responseTagAssignment.findMany).toHaveBeenCalledWith({
      where: { responseId: { in: ['resp-1', 'resp-2'] } },
      include: { tag: true },
    });

    await repo.findAssignmentsByTag('tag-1');
    expect(prismaMock.responseTagAssignment.findMany).toHaveBeenCalledWith({
      where: { tagId: 'tag-1' },
      select: { responseId: true },
    });
  });
});
