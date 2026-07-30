import { tagRepository, responseRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';

export const PREVIEW_TAG_NAME = '__preview__';
export const AI_GENERATED_TAG_NAME = '__ai_generated__';

/** Marks a Response.metadata payload as synthetic test data rather than a
 * real submission — the authoritative marker (independent of tagging,
 * which is best-effort). See fakeResponseService.ts. */
export const AI_GENERATED_RESPONSE_SOURCE = 'ai_generated';

export const getFormTags = async (formId: string) => {
  return tagRepository.listByForm(formId);
};

export const createTag = async (formId: string, name: string, color?: string) => {
  return tagRepository.upsertTag(formId, name.trim(), color);
};

export const deleteTag = async (id: string): Promise<boolean> => {
  try {
    await tagRepository.delete({ where: { id } });
    return true;
  } catch (error) {
    logger.error('Error deleting tag:', error);
    return false;
  }
};

export const addTagToResponse = async (responseId: string, tagId: string): Promise<boolean> => {
  try {
    await tagRepository.assignTag(responseId, tagId);
    return true;
  } catch (error) {
    logger.error('Error adding tag to response:', error);
    return false;
  }
};

export const removeTagFromResponse = async (responseId: string, tagId: string): Promise<boolean> => {
  try {
    await tagRepository.unassignTag(responseId, tagId);
    return true;
  } catch (error) {
    logger.error('Error removing tag from response:', error);
    return false;
  }
};

export const getTagsForResponse = async (responseId: string) => {
  const assignments = await tagRepository.findAssignmentsByResponse(responseId);
  return assignments.map((a) => a.tag);
};

export const batchLoadTagsForResponses = async (responseIds: string[]) => {
  if (!responseIds.length) return {};
  const assignments = await tagRepository.findAssignmentsByResponses(responseIds);
  const map: Record<string, { id: string; formId: string; name: string; color: string; createdAt: Date }[]> = {};
  for (const id of responseIds) map[id] = [];
  for (const a of assignments) {
    if (map[a.responseId]) map[a.responseId].push(a.tag);
  }
  return map;
};

export const upsertPreviewTag = async (formId: string) => {
  return tagRepository.upsertTag(formId, PREVIEW_TAG_NAME, '#f59e0b');
};

export const deletePreviewResponses = async (formId: string): Promise<number> => {
  const previewTag = await tagRepository.findByFormAndName(formId, PREVIEW_TAG_NAME);
  if (!previewTag) return 0;

  const assignments = await tagRepository.findAssignmentsByTag(previewTag.id);
  if (!assignments.length) return 0;

  const responseIds = assignments.map((a) => a.responseId);
  const { count } = await responseRepository.deleteMany({
    where: { id: { in: responseIds } },
  });
  return count;
};

export const upsertAiGeneratedTag = async (formId: string) => {
  return tagRepository.upsertTag(formId, AI_GENERATED_TAG_NAME, '#8b5cf6');
};

/**
 * Deletes every AI-generated fake response for a form. Matches directly on
 * metadata.source rather than the __ai_generated__ tag assignment — tagging
 * in fakeResponseService.ts is best-effort (a failed tag write must not fail
 * the whole generation), so a tag-only lookup could silently strand
 * untagged-but-synthetic rows with no way to bulk-clean them.
 */
export const deleteAiGeneratedResponses = async (formId: string): Promise<number> => {
  const { count } = await responseRepository.deleteMany({
    where: {
      formId,
      metadata: { path: ['source'], equals: AI_GENERATED_RESPONSE_SOURCE },
    },
  });
  return count;
};
