import { generateText, Output } from 'ai';
import { z } from 'zod';
import { createFieldLabelsMap } from '@dculus/utils';
import { getFastModel } from '../../lib/ai.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';
import type { PluginHandler } from '../core/types.js';
import type { AiTaggerPluginConfig } from './types.js';
import { aiTaggerMetadataKey } from './types.js';

const TagIdsSchema = z.object({
  tagIds: z.array(z.string()),
});

export const aiTaggerHandler: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as AiTaggerPluginConfig;

  const tagsWithDefinitions = (config.tags ?? []).filter(
    (t) => t.definition && t.definition.trim().length > 0
  );

  if (tagsWithDefinitions.length === 0) {
    context.logger.info('AI tagger: no tags with definitions, skipping', { formId: event.formId });
    return { success: true, tagsApplied: [], tagsConsidered: 0, tokensUsed: 0 };
  }

  if (!event.data.responseId) {
    context.logger.warn('AI tagger: no responseId in event data', { formId: event.formId });
    return { success: false, error: 'No response ID', tagsApplied: [] };
  }

  try {
    const response = await context.getResponseById(event.data.responseId);
    if (!response) {
      context.logger.warn('AI tagger: response not found', { responseId: event.data.responseId });
      return { success: false, error: 'Response not found', tagsApplied: [] };
    }

    const tagList = tagsWithDefinitions
      .map((t) => `- ID: "${t.tagId}" | Name: "${t.name}" | Definition: "${t.definition}"`)
      .join('\n');

    // Resolve field IDs to human-readable labels so the AI has context.
    // Form fields live in Hocuspocus (Y.js), not in Form.formSchema.
    let fieldLabelMap: Record<string, string> = {};
    try {
      const schema = await getFormSchemaFromHocuspocus(event.formId);
      if (schema) {
        fieldLabelMap = createFieldLabelsMap(schema);
      }
    } catch {
      // Fall back to raw field IDs if schema resolution fails
    }

    const SKIP_KEYS = new Set(['responseId', 'submittedAt']);
    const responseFields = Object.entries((response.data as Record<string, any>) ?? {})
      .filter(([key]) => !SKIP_KEYS.has(key))
      .map(([key, value]) => {
        const label = fieldLabelMap[key] ?? key;
        const displayValue = Array.isArray(value) ? value.join(', ') : (value ?? '(no answer)');
        return `[${label}]: ${displayValue}`;
      })
      .join('\n');

    const { output, usage } = await generateText({
      model: getFastModel(),
      output: Output.object({ schema: TagIdsSchema }),
      system: `You are a response classifier for a form submission system.
Given a form response and a list of tags with definitions, return the IDs of all tags that apply.
Only apply a tag if the response clearly matches its definition.
Return an empty array if none match.`,
      prompt: `Tags to consider:\n${tagList}\n\nForm response:\n${responseFields}`,
    });

    const validTagIds = new Set(tagsWithDefinitions.map((t) => t.tagId));
    const confirmedTagIds = (output.tagIds ?? []).filter((id: string) => validTagIds.has(id));

    for (const tagId of confirmedTagIds) {
      await context.prisma.responseTagAssignment.upsert({
        where: { responseId_tagId: { responseId: response.id, tagId } },
        create: { responseId: response.id, tagId },
        update: {},
      });
    }

    const existingMetadata = (response.metadata as Record<string, any>) || {};
    const result = {
      success: true,
      tagsApplied: confirmedTagIds,
      tagsConsidered: tagsWithDefinitions.length,
      tokensUsed: usage?.totalTokens ?? 0,
      taggedAt: new Date().toISOString(),
    };

    await context.prisma.response.update({
      where: { id: response.id },
      data: { metadata: { ...existingMetadata, [aiTaggerMetadataKey(plugin.id)]: result } },
    });

    context.logger.info('AI tagger: tags applied', {
      responseId: response.id,
      tagsApplied: confirmedTagIds,
      tokensUsed: result.tokensUsed,
    });

    return result;
  } catch (error: any) {
    context.logger.error('AI tagger: failed silently', {
      error: error.message,
      formId: event.formId,
      responseId: event.data.responseId,
    });
    return { success: false, error: error.message, tagsApplied: [] };
  }
};
