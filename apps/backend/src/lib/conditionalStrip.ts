/**
 * Server-side conditional-logic enforcement (defense in depth).
 *
 * The viewer strips hidden-field values at submit, but submitResponse /
 * updateResponse are public GraphQL mutations — a crafted request can bypass
 * the client gate entirely. This applies the same pure evaluator against the
 * form's schema so persisted responses can never contain values for fields
 * (or pages) the form's rules hide. See docs/conditional-logic-research.md §5.2
 * and the locked client-side semantics in docs/conditional-logic-v1-strategy.md §5.
 */

import {
  deserializeFormSchema,
  evaluateConditions,
  stripHiddenResponses,
  type FormResponsesByPage,
} from '@dculus/types';

/**
 * Strips values of conditionally hidden fields/pages from a flat
 * fieldId→value response payload, evaluated against the given form schema
 * (raw JSON as stored in the DB or reconstructed from Hocuspocus).
 *
 * - Schemas without conditions return the payload unchanged (fast path).
 * - Keys that don't belong to any schema field pass through untouched —
 *   they are not schema-managed, so conditional rules can't apply to them.
 * - Malformed schemas never throw; the payload is returned as-is.
 */
export const stripConditionallyHiddenValues = (
  rawSchema: unknown,
  flatData: Record<string, unknown>
): Record<string, unknown> => {
  if (!flatData || typeof flatData !== 'object') return flatData;
  if (!rawSchema || typeof rawSchema !== 'object') return flatData;

  try {
    // deserializeFormSchema sanitizes conditions at this trust boundary
    const schema = deserializeFormSchema(rawSchema);
    if (!schema.conditions || schema.conditions.length === 0) return flatData;

    const fieldToPage = new Map<string, string>();
    for (const page of schema.pages ?? []) {
      for (const field of page.fields ?? []) {
        fieldToPage.set(field.id, page.id);
      }
    }

    // Rebuild the page-keyed shape the evaluator works on
    const byPage: FormResponsesByPage = {};
    const passthrough: Record<string, unknown> = {};
    for (const [fieldId, value] of Object.entries(flatData)) {
      const pageId = fieldToPage.get(fieldId);
      if (!pageId) {
        passthrough[fieldId] = value;
        continue;
      }
      (byPage[pageId] ??= {})[fieldId] = value;
    }

    const visibility = evaluateConditions(schema.conditions, byPage, schema);
    const stripped = stripHiddenResponses(byPage, visibility);

    const result: Record<string, unknown> = { ...passthrough };
    for (const pageResponses of Object.values(stripped)) {
      Object.assign(result, pageResponses);
    }
    return result;
  } catch {
    // Enforcement must never take submission down — worst case we fall back
    // to the client-side strip, which is v1's shipped behavior
    return flatData;
  }
};
