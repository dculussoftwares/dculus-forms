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

    // Resolve field IDs to human-readable labels + options so the AI has full context.
    // Form fields live in Hocuspocus (Y.js), not in Form.formSchema.
    let fieldLabelMap: Record<string, string> = {};
    const fieldOptionsMap: Record<string, string[]> = {};
    try {
      const schema = await getFormSchemaFromHocuspocus(event.formId);
      if (schema) {
        fieldLabelMap = createFieldLabelsMap(schema);
        for (const page of schema.pages ?? []) {
          for (const field of page.fields ?? []) {
            if (field?.id && Array.isArray((field as any).options) && (field as any).options.length > 0) {
              fieldOptionsMap[field.id] = (field as any).options as string[];
            }
          }
        }
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
        const options = fieldOptionsMap[key];
        const optionsHint = options ? ` [all options: ${options.join(' | ')}]` : '';
        return `[${label}]${optionsHint}: ${displayValue}`;
      })
      .join('\n');

    const { output, usage } = await generateText({
      model: getFastModel(),
      output: Output.object({ schema: TagIdsSchema }),
      system: `You are a response classifier for a form submission system.
Given a form response and a list of tags with definitions, return the IDs of the tags that apply.

Rules:
- For choice fields (radio, select), the "[all options: ...]" hint lists every option for that field. Use the full list to understand relative meaning. For example, if options are "Weekly | Bi-weekly | Monthly | Only major updates", then Weekly/Bi-weekly represent frequent contact and Monthly/Only major updates represent infrequent contact.
- Apply your best interpretation of each tag definition, even if the wording is imperfect or informal.
- When two tags have similar definitions, pick the single best-fitting one based on the response. Apply both only if the response independently satisfies each definition.
- Return an empty array only if no tag has any reasonable match.
- You MUST respond with valid JSON matching exactly: {"tagIds": ["id1", "id2"]}`,
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
