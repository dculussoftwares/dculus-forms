import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const getFormTags = async (formId: string) => {
  return prisma.responseTag.findMany({
    where: { formId },
    orderBy: { createdAt: 'asc' },
  });
};

export const createTag = async (formId: string, name: string, color?: string) => {
  return prisma.responseTag.upsert({
    where: { formId_name: { formId, name: name.trim() } },
    update: { color: color ?? '#6366f1' },
    create: { formId, name: name.trim(), color: color ?? '#6366f1' },
  });
};

export const deleteTag = async (id: string): Promise<boolean> => {
  try {
    await prisma.responseTag.delete({ where: { id } });
    return true;
  } catch (error) {
    logger.error('Error deleting tag:', error);
    return false;
  }
};

export const addTagToResponse = async (responseId: string, tagId: string): Promise<boolean> => {
  try {
    await prisma.responseTagAssignment.upsert({
      where: { responseId_tagId: { responseId, tagId } },
      update: {},
      create: { responseId, tagId },
    });
    return true;
  } catch (error) {
    logger.error('Error adding tag to response:', error);
    return false;
  }
};

export const removeTagFromResponse = async (responseId: string, tagId: string): Promise<boolean> => {
  try {
    await prisma.responseTagAssignment.delete({
      where: { responseId_tagId: { responseId, tagId } },
    });
    return true;
  } catch (error) {
    logger.error('Error removing tag from response:', error);
    return false;
  }
};

export const getTagsForResponse = async (responseId: string) => {
  const assignments = await prisma.responseTagAssignment.findMany({
    where: { responseId },
    include: { tag: true },
  });
  return assignments.map((a) => a.tag);
};

export const batchLoadTagsForResponses = async (responseIds: string[]) => {
  if (!responseIds.length) return {};
  const assignments = await prisma.responseTagAssignment.findMany({
    where: { responseId: { in: responseIds } },
    include: { tag: true },
  });
  const map: Record<string, { id: string; formId: string; name: string; color: string; createdAt: Date }[]> = {};
  for (const id of responseIds) map[id] = [];
  for (const a of assignments) {
    if (map[a.responseId]) map[a.responseId].push(a.tag);
  }
  return map;
};
