import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for ResponseTag / ResponseTagAssignment data access.
 */
export const createTagRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (ResponseTag) --- */
  const findMany = <T extends Prisma.ResponseTagFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ResponseTagFindManyArgs>
  ) => prisma.responseTag.findMany(args);

  const findFirst = <T extends Prisma.ResponseTagFindFirstArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ResponseTagFindFirstArgs>
  ) => prisma.responseTag.findFirst(args);

  const upsert = <T extends Prisma.ResponseTagUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseTagUpsertArgs>
  ) => prisma.responseTag.upsert(args);

  const remove = <T extends Prisma.ResponseTagDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseTagDeleteArgs>
  ) => prisma.responseTag.delete(args);

  /** --- Generic delegate passthroughs (ResponseTagAssignment) --- */
  const findManyAssignments = <T extends Prisma.ResponseTagAssignmentFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.ResponseTagAssignmentFindManyArgs>
  ) => prisma.responseTagAssignment.findMany(args);

  const upsertAssignment = <T extends Prisma.ResponseTagAssignmentUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseTagAssignmentUpsertArgs>
  ) => prisma.responseTagAssignment.upsert(args);

  const removeAssignment = <T extends Prisma.ResponseTagAssignmentDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseTagAssignmentDeleteArgs>
  ) => prisma.responseTagAssignment.delete(args);

  const createMany = <T extends Prisma.ResponseTagAssignmentCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ResponseTagAssignmentCreateManyArgs>
  ) => prisma.responseTagAssignment.createMany(args);

  /** --- Domain-oriented helpers --- */
  const listByForm = async (formId: string) =>
    prisma.responseTag.findMany({
      where: { formId },
      orderBy: { createdAt: 'asc' },
    });

  const upsertTag = async (formId: string, name: string, color?: string) =>
    prisma.responseTag.upsert({
      where: { formId_name: { formId, name } },
      update: { color: color ?? '#6366f1' },
      create: { formId, name, color: color ?? '#6366f1' },
    });

  /** Creates the tag with `color` if missing; a no-op if it already exists. */
  const ensureTag = async (formId: string, name: string, color: string) =>
    prisma.responseTag.upsert({
      where: { formId_name: { formId, name } },
      update: {},
      create: { formId, name, color },
    });

  const findByFormAndName = async (formId: string, name: string) =>
    prisma.responseTag.findFirst({ where: { formId, name } });

  const assignTag = async (responseId: string, tagId: string) =>
    prisma.responseTagAssignment.upsert({
      where: { responseId_tagId: { responseId, tagId } },
      update: {},
      create: { responseId, tagId },
    });

  const unassignTag = async (responseId: string, tagId: string) =>
    prisma.responseTagAssignment.delete({
      where: { responseId_tagId: { responseId, tagId } },
    });

  const findAssignmentsByResponse = async (responseId: string) =>
    prisma.responseTagAssignment.findMany({
      where: { responseId },
      include: { tag: true },
    });

  const findAssignmentsByResponses = async (responseIds: string[]) =>
    prisma.responseTagAssignment.findMany({
      where: { responseId: { in: responseIds } },
      include: { tag: true },
    });

  const findAssignmentsByTag = async (tagId: string) =>
    prisma.responseTagAssignment.findMany({
      where: { tagId },
      select: { responseId: true },
    });

  return {
    // Generic operations
    findMany,
    findFirst,
    upsert,
    delete: remove,
    findManyAssignments,
    upsertAssignment,
    deleteAssignment: removeAssignment,
    createMany,

    // Domain helpers
    listByForm,
    upsertTag,
    ensureTag,
    findByFormAndName,
    assignTag,
    unassignTag,
    findAssignmentsByResponse,
    findAssignmentsByResponses,
    findAssignmentsByTag,
  };
};

export type TagRepository = ReturnType<typeof createTagRepository>;

export const tagRepository = createTagRepository();
