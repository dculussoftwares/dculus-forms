import { generateId } from '@dculus/utils';
import { FieldType } from '@dculus/types';
import { Prisma } from '#prisma-client';
import { prisma } from '../lib/prisma.js';
import { responseRepository } from '../repositories/index.js';
import { generateAiFakeResponses } from './aiService.js';
import { coerceAiSampleData } from './pdfTemplateService.js';
import { ensureSyntheticResponseFile } from './fileUploadService.js';
import { upsertAiGeneratedTag, AI_GENERATED_RESPONSE_SOURCE } from './tagService.js';
import { logger } from '../lib/logger.js';

export { AI_GENERATED_RESPONSE_SOURCE };

/** Hard cap on how many fake responses can be generated per request — keeps
 * the single batched model call, and the resulting bulk insert, bounded. */
export const MAX_FAKE_RESPONSES_PER_REQUEST = 10;

export function isAiGeneratedResponse(metadata: unknown): boolean {
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    (metadata as Record<string, unknown>).source === AI_GENERATED_RESPONSE_SOURCE
  );
}

/**
 * Field descriptors for the fake-response AI prompt. Unlike
 * buildAiFieldEntries (PDF sample-data preview), this also excludes
 * file-upload fields — those are filled deterministically with a shared
 * placeholder file, never invented by the model.
 */
function buildFakeResponseFieldEntries(
  deserializedSchema: any
): { id: string; type: string; label: string; options?: string[] }[] {
  const entries: { id: string; type: string; label: string; options?: string[] }[] = [];
  for (const page of deserializedSchema?.pages ?? []) {
    for (const field of page?.fields ?? []) {
      if (!field?.id) continue;
      if (field.type === FieldType.RICH_TEXT_FIELD || field.type === FieldType.FILE_UPLOAD_FIELD) {
        continue;
      }
      const options = Array.isArray(field.options) ? field.options : undefined;
      entries.push({
        id: field.id,
        type: String(field.type).replace(/_field$/, '').replace(/_/g, ' '),
        label: String(field.label ?? '').slice(0, 200),
        ...(options?.length ? { options } : {}),
      });
    }
  }
  return entries;
}

function hasFileUploadField(deserializedSchema: any): boolean {
  return (deserializedSchema?.pages ?? []).some((page: any) =>
    (page?.fields ?? []).some((field: any) => field?.type === FieldType.FILE_UPLOAD_FIELD)
  );
}

export interface GenerateFakeResponsesResult {
  created: number;
  tokensUsed: number;
}

/**
 * Generates up to MAX_FAKE_RESPONSES_PER_REQUEST realistic, diverse fake
 * responses for a form via a single AI call, and bulk-inserts them directly
 * (bypassing submitResponse's public-submission side effects: no plugin
 * events, no subscription usage tracking, no submission-limit checks — this
 * is an EDITOR-only test-data tool, not a public submission path). Each row
 * is tagged via metadata.source so field analytics can exclude it.
 */
export async function generateFakeResponsesForForm(
  formId: string,
  formTitle: string,
  deserializedSchema: any,
  count: number
): Promise<GenerateFakeResponsesResult> {
  const boundedCount = Math.max(1, Math.min(count, MAX_FAKE_RESPONSES_PER_REQUEST));
  const entries = buildFakeResponseFieldEntries(deserializedSchema);

  const syntheticFileKey = hasFileUploadField(deserializedSchema)
    ? await ensureSyntheticResponseFile(formId)
    : null;

  // Nothing for the model to answer (form is only rich-text/file-upload
  // fields) — skip the AI call entirely rather than spend credits on a
  // response with no fields to fill.
  const aiResult = entries.length > 0
    ? await generateAiFakeResponses({ formTitle, entries, count: boundedCount })
    : { responses: Array(boundedCount).fill({}), tokensUsed: 0 };

  const rows = aiResult.responses.slice(0, boundedCount).map((answers) => {
    const data = coerceAiSampleData(deserializedSchema, answers);

    if (syntheticFileKey) {
      for (const page of deserializedSchema?.pages ?? []) {
        for (const field of page?.fields ?? []) {
          if (field?.id && field.type === FieldType.FILE_UPLOAD_FIELD) {
            data[field.id] = [syntheticFileKey];
          }
        }
      }
    }

    return {
      id: generateId(),
      formId,
      data: data as Prisma.InputJsonValue,
      metadata: { source: AI_GENERATED_RESPONSE_SOURCE } as Prisma.InputJsonValue,
    };
  });

  if (rows.length > 0) {
    await responseRepository.createMany({ data: rows });

    // Tag assignment is best-effort — the responses themselves (and their
    // metadata.source marker used for analytics exclusion) are already
    // persisted, so a tagging failure shouldn't fail the whole generation.
    try {
      const tag = await upsertAiGeneratedTag(formId);
      await prisma.responseTagAssignment.createMany({
        data: rows.map((row) => ({ responseId: row.id, tagId: tag.id })),
      });
    } catch (error) {
      logger.error({ err: error, formId }, 'Failed to tag AI-generated responses');
    }
  }

  return { created: rows.length, tokensUsed: aiResult.tokensUsed };
}
