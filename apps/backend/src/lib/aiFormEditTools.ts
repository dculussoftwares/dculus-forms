import { tool } from 'ai';
import { z } from 'zod';
import { conditionalRuleSchema, sanitizeConditions, type ConditionOperator, type ConditionalRule } from '@dculus/types';
import { generateRandomString } from '@dculus/utils';
import { countResponsesPerField, countResponsesReferencingAnyField } from '../services/responseService.js';
import { prisma } from './prisma.js';

// Field type tokens the AI uses (kept in sync with addField's fieldType enum).
const FIELD_TYPE_TOKENS = ['text', 'textarea', 'email', 'number', 'date', 'select', 'radio', 'checkbox', 'file', 'phone'] as const;

// Normalize a stored field type (e.g. 'text_input_field' / 'TEXT_INPUT_FIELD') to the short token.
const STORED_TYPE_TO_TOKEN: Record<string, string> = {
  text_input_field: 'text',  TEXT_INPUT_FIELD: 'text',
  text_area_field: 'textarea', TEXT_AREA_FIELD: 'textarea',
  email_field: 'email',      EMAIL_FIELD: 'email',
  number_field: 'number',    NUMBER_FIELD: 'number',
  date_field: 'date',        DATE_FIELD: 'date',
  select_field: 'select',    SELECT_FIELD: 'select',
  radio_field: 'radio',      RADIO_FIELD: 'radio',
  checkbox_field: 'checkbox', CHECKBOX_FIELD: 'checkbox',
  file_upload_field: 'file', FILE_UPLOAD_FIELD: 'file',
  phone_number_field: 'phone', PHONE_NUMBER_FIELD: 'phone',
};

function findFieldInSchema(
  schema: { pages: any[] },
  fieldId: string
): { pageId: string; field: any } | null {
  for (const page of (schema.pages ?? []) as any[]) {
    const field = (page.fields ?? []).find((f: any) => f.id === fieldId);
    if (field) return { pageId: page.id, field };
  }
  return null;
}

const CONDITION_OPERATORS_BY_TYPE: Record<string, readonly ConditionOperator[]> = {
  text_input_field: ['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'isEmpty', 'isFilled'],
  text_area_field: ['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'isEmpty', 'isFilled'],
  email_field: ['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'isEmpty', 'isFilled'],
  phone_number_field: ['equals', 'notEquals', 'startsWith', 'isEmpty', 'isFilled'],
  number_field: ['equals', 'notEquals', 'lessThan', 'greaterThan', 'isEmpty', 'isFilled'],
  date_field: ['equals', 'notEquals', 'before', 'after', 'isEmpty', 'isFilled'],
  select_field: ['equals', 'notEquals', 'isEmpty', 'isFilled'],
  radio_field: ['equals', 'notEquals', 'isEmpty', 'isFilled'],
  checkbox_field: ['contains', 'notContains', 'isEmpty', 'isFilled'],
  file_upload_field: ['isEmpty', 'isFilled'],
};

/** Normalise a stored field type string to lowercase for map lookups (e.g. 'TEXT_INPUT_FIELD' → 'text_input_field'). */
const normalizeFieldType = (type: unknown): string => String(type ?? '').toLowerCase();
/** Normalise a label or title to lowercase alphanumeric words for fuzzy comparison. */
const normalizeLabel = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Resolve an AI-supplied field label (or id) without ever guessing a weak match. */
function resolveField(schema: { pages: any[] }, reference: string): any | null {
  const fields = (schema.pages ?? []).flatMap((page: any) => page.fields ?? []);
  const direct = fields.find((field: any) => field.id === reference);
  if (direct) return direct;
  const wanted = normalizeLabel(reference);
  const exact = fields.filter((field: any) => normalizeLabel(String(field.label ?? '')) === wanted);
  if (exact.length === 1) return exact[0];
  const partial = fields.filter((field: any) => {
    const label = normalizeLabel(String(field.label ?? ''));
    return wanted.length >= 3 && (label.includes(wanted) || wanted.includes(label));
  });
  return partial.length === 1 ? partial[0] : null;
}

const updatesSchema = z.object({
  label: z.string().optional(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  hint: z.string().optional(),
  options: z.array(z.string()).optional(),
  validation: z.object({
    required: z.boolean().optional(),
    minLength: z.number().nullable().optional(),
    maxLength: z.number().nullable().optional(),
    minSelections: z.number().nullable().optional(),
    maxSelections: z.number().nullable().optional(),
  }).optional(),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  minDate: z.string().nullable().optional(),
  maxDate: z.string().nullable().optional(),
});

export type ToolTier = 'full' | 'core' | 'minimal';

// Plugin (integration) types the AI may propose. Mirrors the handlers registered in
// apps/backend/src/plugins/ that have stable, AI-describable config shapes.
// quiz-grading is deprecated (native quiz mode replaces it — see Form Settings → Quiz) and is
// deliberately excluded so the AI stops proposing a plugin type the API no longer accepts.
const AI_PLUGIN_TYPES = ['webhook', 'email'] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createFormEditTools(
  schema: { pages: any[] },
  opts?: { includeReadTools?: boolean; formId?: string; toolTier?: ToolTier; canManagePlugins?: boolean }
) {
  const includeReadTools = opts?.includeReadTools !== false;
  const formId = opts?.formId;
  const toolTier = opts?.toolTier ?? 'full';
  // Plugins send data to external systems — createFormPlugin requires form OWNER access, so
  // the plugin tools are only offered when the caller's resolved permission allows using them.
  const canManagePlugins = opts?.canManagePlugins === true;
  const totalFields = (schema.pages ?? []).reduce((n: number, p: any) => n + (p.fields?.length ?? 0), 0);
  const totalPages = (schema.pages ?? []).length;

  // Deep-clone so in-turn mutations don't corrupt the shared schema cache, and so later tool
  // calls in the same AI turn (e.g. removePage after relocateField) see accurate field counts.
  const workingSchema: { pages: any[] } = JSON.parse(JSON.stringify(schema));

  // Per-field response count for delete/convert warnings (0 when formId is unavailable).
  const responseCountFor = async (fieldId: string): Promise<number> => {
    if (!formId) return 0;
    const counts = await countResponsesPerField(formId, [fieldId]);
    return counts[fieldId] ?? 0;
  };

  const readTools = {
    listFields: tool({
      description:
        'List form fields in compact format: p1 "Title" [id:pageId]: fieldId|type|"label"|req/opt. Omit pageId to list all pages.',
      inputSchema: z.object({
        pageId: z.string().optional().describe('Filter to this page; omit to list all pages'),
      }),
      execute: async ({ pageId }) => {
        const pages: any[] = workingSchema.pages ?? [];
        const filtered = pageId ? pages.filter((p: any) => p.id === pageId) : pages;

        const TYPE_MAP: Record<string, string> = {
          text_input_field: 'text',  TEXT_INPUT_FIELD: 'text',
          text_area_field: 'ta',     TEXT_AREA_FIELD: 'ta',
          email_field: 'email',      EMAIL_FIELD: 'email',
          number_field: 'num',       NUMBER_FIELD: 'num',
          date_field: 'date',        DATE_FIELD: 'date',
          select_field: 'select',    SELECT_FIELD: 'select',
          radio_field: 'radio',      RADIO_FIELD: 'radio',
          checkbox_field: 'check',   CHECKBOX_FIELD: 'check',
          file_upload_field: 'file', FILE_UPLOAD_FIELD: 'file',
          phone_number_field: 'phone', PHONE_NUMBER_FIELD: 'phone',
        };

        return {
          summary: `${pages.length} page${pages.length !== 1 ? 's' : ''} total`,
          pages: filtered.map((p: any) => {
            const pi = pages.indexOf(p) + 1;
            const fields = (p.fields ?? [])
              .map((f: any) => `${f.id}|${TYPE_MAP[f.type] ?? f.type}|"${f.label}"|${(f.required ?? false) ? 'req' : 'opt'}`)
              .join(', ');
            return `p${pi} "${p.title ?? `Page ${pi}`}" [id:${p.id}]: ${fields || '(empty)'}`;
          }),
        };
      },
    }),

    getField: tool({
      description:
        'Get field details (placeholder, hint, options, validation, pageId). Call before updating to see current values.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID from listFields'),
      }),
      execute: async ({ fieldId }) => {
        for (const page of (workingSchema.pages ?? []) as any[]) {
          const field = (page.fields ?? []).find((f: any) => f.id === fieldId);
          if (field) {
            return {
              pageId: page.id,
              id: field.id,
              type: field.type,
              label: field.label,
              required: field.required ?? false,
              placeholder: field.placeholder ?? null,
              hint: field.hint ?? null,
              options: field.options ?? null,
              validation: field.validation ?? null,
            };
          }
        }
        return { error: `Field ${fieldId} not found` };
      },
    }),
  };

  const mutationTools = {
    addField: tool({
      description:
        'Create a NEW field on a page. ALWAYS use this for "add/create/insert" requests — never repurpose existing fields via updateFields. insertAfterFieldId positions it; null appends at end.',
      inputSchema: z.object({
        pageId: z.string().describe('ID of the page to add the field to'),
        insertAfterFieldId: z.string().nullable().describe('Insert after this field ID; null to append'),
        fieldType: z.enum(['text', 'textarea', 'email', 'number', 'date', 'select', 'radio', 'checkbox', 'file', 'phone']),
        label: z.string().describe('The question/label shown to users'),
        required: z.boolean(),
        placeholder: z.string().nullable(),
        options: z.array(z.string()).nullable().describe('For select/radio/checkbox only; null otherwise'),
      }),
      execute: async (args) => ({ type: 'ADD_FIELD' as const, ...args }),
    }),

    updateFields: tool({
      description:
        'Update existing fields. Use ONLY for explicit edits ("rename", "change options", "make required") — never for "add" requests. Pass multiple fieldIds for batch updates. text: validation.min/maxLength. number: min/max. date: minDate/maxDate.',
      inputSchema: z.object({
        fieldIds: z.array(z.string()).min(1).describe('IDs of all fields to update (min 1)'),
        updates: updatesSchema,
      }),
      execute: async (args) => ({ type: 'UPDATE_FIELDS' as const, ...args }),
    }),

    removeFields: tool({
      description:
        'PROPOSAL: propose removing fields. Does NOT delete — user must confirm in the card. Say "will be deleted once confirmed", never "deleted". Batch: pass multiple fieldIds.',
      inputSchema: z.object({
        fieldIds: z.array(z.string()).min(1).describe('IDs of all fields to remove (min 1)'),
      }),
      execute: async ({ fieldIds }) => {
        const counts = formId ? await countResponsesPerField(formId, fieldIds) : {};
        const fields = fieldIds.map((fieldId) => {
          const found = findFieldInSchema(workingSchema, fieldId);
          return {
            fieldId,
            label: found?.field?.label ?? fieldId,
            responseCount: counts[fieldId] ?? 0,
          };
        });
        return { type: 'PROPOSE_DELETE_FIELDS' as const, fields };
      },
    }),

    relocateField: tool({
      description:
        'Move or copy a field between pages (not for same-page reordering — use reorder). For merge/consolidate: relocate ALL fields first, THEN removePage on empty source pages.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID — get it from listFields'),
        targetPageId: z.string().describe('Destination page ID — get it from listFields'),
        insertAfterFieldId: z.string().nullable().describe('Insert after this field ID on the target page; null to append'),
        mode: z.enum(['move', 'copy']).describe('"move" relocates the field; "copy" duplicates it'),
      }),
      execute: async (args) => {
        if (args.mode === 'move') {
          // Reflect the move in workingSchema so subsequent tools (e.g. removePage) see
          // accurate field counts instead of the stale pre-move snapshot.
          for (const page of workingSchema.pages as any[]) {
            const idx = (page.fields ?? []).findIndex((f: any) => f.id === args.fieldId);
            if (idx !== -1) {
              const [field] = page.fields.splice(idx, 1);
              const targetPage = workingSchema.pages.find((p: any) => p.id === args.targetPageId);
              if (targetPage) {
                if (!targetPage.fields) targetPage.fields = [];
                if (args.insertAfterFieldId) {
                  const insertIdx = targetPage.fields.findIndex((f: any) => f.id === args.insertAfterFieldId);
                  targetPage.fields.splice(insertIdx + 1, 0, field);
                } else {
                  targetPage.fields.push(field);
                }
              }
              break;
            }
          }
        }
        return { type: 'RELOCATE_FIELD' as const, ...args };
      },
    }),

    reorder: tool({
      description:
        'Reorder fields (scope "fields", pageId required) or pages (scope "pages"). Pass all ids in the new desired order.',
      inputSchema: z.object({
        scope: z.enum(['fields', 'pages']).describe('"fields" reorders fields on a page; "pages" reorders pages'),
        ids: z.array(z.string()).describe('All IDs in the new desired order'),
        pageId: z.string().optional().describe('Required when scope="fields": the page whose fields are reordered'),
      }),
      execute: async (args) => {
        if (args.scope === 'fields' && !args.pageId) {
          return { error: 'pageId is required when scope is "fields"' };
        }
        return { type: 'REORDER' as const, ...args };
      },
    }),

    updateLayout: tool({
      description: 'Update the form intro content (HTML) or the CTA button label.',
      inputSchema: z.object({
        content: z.string().optional().describe('HTML intro: <h1> title + <p> description only'),
        customCTAButtonName: z.string().optional().describe('Short CTA button label, max 4 words'),
      }),
      execute: async (args) => ({ type: 'UPDATE_LAYOUT' as const, ...args }),
    }),

    renamePage: tool({
      description: 'Rename a page. Get the pageId from listFields.',
      inputSchema: z.object({
        pageId: z.string().describe('The page ID from listFields'),
        newTitle: z.string().max(50).describe('New title for the page'),
      }),
      execute: async (args) => ({ type: 'RENAME_PAGE' as const, ...args }),
    }),

    addPage: tool({
      description:
        'Add a page. Use the returned pageId for subsequent addField calls on this page — never invent a page ID. insertAfterPageId positions it; null appends.',
      inputSchema: z.object({
        title: z.string().max(50).describe('Title for the new page'),
        insertAfterPageId: z.string().nullable().describe('Insert after this page ID; null to append at end'),
      }),
      execute: async (args) => {
        const pageId = `p${generateRandomString(9)}`;
        const newPage = { id: pageId, title: args.title, fields: [] };
        if (args.insertAfterPageId) {
          const insertIdx = workingSchema.pages.findIndex((p: any) => p.id === args.insertAfterPageId);
          workingSchema.pages.splice(insertIdx + 1, 0, newPage);
        } else {
          workingSchema.pages.push(newPage);
        }
        return { type: 'ADD_PAGE' as const, pageId, ...args };
      },
    }),

    removePage: tool({
      description:
        'PROPOSAL: propose deleting a page + all its fields. Does NOT delete — user must confirm. Cannot remove the last page. For merges: relocate all fields off the page first.',
      inputSchema: z.object({
        pageId: z.string().describe('The page ID from listFields'),
      }),
      execute: async ({ pageId }) => {
        const pages = (workingSchema.pages ?? []) as any[];
        if (pages.length <= 1) return { error: 'Cannot remove the last page' };
        const page = pages.find((p) => p.id === pageId);
        if (!page) return { error: `Page ${pageId} not found` };
        const fieldIds = (page.fields ?? []).map((f: any) => f.id);
        const responseCount = formId
          ? await countResponsesReferencingAnyField(formId, fieldIds)
          : 0;
        return {
          type: 'PROPOSE_DELETE_PAGE' as const,
          pageId,
          pageTitle: page.title ?? 'Untitled page',
          fieldCount: fieldIds.length,
          responseCount,
            ...(fieldIds.length > 0 && {
            warning: `This page has ${fieldIds.length} field(s) that will be permanently deleted. If you are merging pages, call relocateField for each field first, then call removePage on the now-empty page.`,
          }),
        };
      },
    }),

    navigateToPage: tool({
      description:
        'Navigate canvas to a page. Call BEFORE editing fields on a page the user is not currently viewing.',
      inputSchema: z.object({
        pageId: z.string().describe('The page ID to navigate to — get it from listFields'),
      }),
      execute: async ({ pageId }) => ({ type: 'NAVIGATE_TO_PAGE' as const, pageId }),
    }),

    proposeValidation: tool({
      description:
        'PROPOSAL: suggest validation rules for user review. Never apply validation via updateFields directly — always use this tool for user confirmation.',
      inputSchema: z.object({
        suggestions: z.array(
          z.object({
            fieldId: z.string(),
            fieldLabel: z.string(),
            fieldType: z.string(),
            validation: z
              .object({
                minLength: z.number().nullable().optional(),
                maxLength: z.number().nullable().optional(),
                minSelections: z.number().nullable().optional(),
                maxSelections: z.number().nullable().optional(),
              })
              .optional(),
            min: z.number().nullable().optional(),
            max: z.number().nullable().optional(),
            required: z.boolean().optional(),
          })
        ),
        rationale: z.string().describe('Brief explanation of why these rules were chosen'),
      }),
      execute: async (args) => ({ type: 'PROPOSE_VALIDATION' as const, ...args }),
    }),

    proposeFieldTypeChange: tool({
      description:
        'PROPOSAL: convert a field to a different type. Does NOT apply — user must confirm. Converting deletes the field and creates a new one; existing responses will NOT carry over. Make this clear to the user.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID to convert — get it from listFields'),
        newFieldType: z.enum(FIELD_TYPE_TOKENS).describe('The target field type'),
      }),
      execute: async ({ fieldId, newFieldType }) => {
        const found = findFieldInSchema(workingSchema, fieldId);
        if (!found) return { error: `Field ${fieldId} not found` };
        const currentType = STORED_TYPE_TO_TOKEN[found.field.type] ?? found.field.type;
        if (currentType === newFieldType) {
          return { error: `Field is already a ${newFieldType} field` };
        }
        return {
          type: 'PROPOSE_FIELD_TYPE_CHANGE' as const,
          fieldId,
          label: found.field.label ?? fieldId,
          currentType,
          newFieldType,
          responseCount: await responseCountFor(fieldId),
        };
      },
    }),

    /**
     * AI tool: converts a natural-language condition description into a single
     * `ConditionalRule` proposal.  The rule is returned as `PROPOSE_CONDITION_RULE`
     * and must be explicitly accepted by the user — it is never auto-applied.
     * Field and page references are resolved by label/title or id; every proposed
     * rule is validated by `conditionalRuleSchema` and sanitised by
     * `sanitizeConditions` before being returned.
     */
    upsertConditionRule: tool({
      description:
        'PROPOSAL: turn a described condition into ONE ready-to-review rule. Never apply it directly. Terms may identify trigger fields by their visible label or id; targets may identify fields/pages by label/title or id. Use only operators appropriate for each trigger field type. Rich text/display-only fields cannot be triggers. Terms are ALWAYS written exactly as the description states — never invert an operator (e.g. equals -> notEquals) to compensate for "unless"/"except" phrasing; that phrasing is handled entirely by defaultState below, not by the terms.\n\n' +
        'setFieldVisibility/setPageVisibility take a defaultState instead of a show/hide verb — this is deliberate: do NOT try to translate the description\'s verb into an action name yourself, answer the defaultState question below and the system derives the correct mechanics.\n' +
        'defaultState = the state of X when these terms are NOT matching (its normal/starting state, before any relevant answer is given) — NOT the state while the terms match:\n' +
        '  * "Hide X unless P" / "Hide X except (when) P" / "Only show X if/when P"  -> defaultState "hidden" (the stated verb IS the normal state; "unless/except" carves out the one case where it flips)\n' +
        '  * "Show X unless P" / "Show X except (when) P" / "Only hide X if/when P"  -> defaultState "visible" (same reasoning, opposite verb)\n' +
        '  * "Hide X when P" / "Hide X if P" (no unless/except/only)                -> defaultState "visible" (X is normally shown; P is what triggers hiding it)\n' +
        '  * "Show X when P" / "Show X if P" (no unless/except/only)                -> defaultState "hidden" (X is normally hidden; P is what triggers showing it)\n' +
        'requireField/unrequireField use the same "state when terms are NOT matching" logic but only ever change the required flag — they never affect visibility. If the same target is also hidden by another rule, hidden always wins (a hidden field is never enforced as required), so don\'t add a redundant unrequireField just because a field is also conditionally hidden.\n' +
        'skipToPage only ever skips forward — from the trigger\'s page to a later page — hiding the pages strictly between them. Never propose skipToPage to the current page, an earlier page, or as a substitute for hidePage on the trigger\'s own page.',
      inputSchema: z.object({
        combinator: z.enum(['any', 'all']),
        terms: z.array(z.object({
          field: z.string().min(1).describe('Trigger field label or id'),
          operator: z.enum(['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'isEmpty', 'isFilled', 'lessThan', 'greaterThan', 'before', 'after']),
          value: z.union([z.string(), z.number(), z.array(z.string())]).optional().describe('Single comparison value — never a list. For a select/radio/checkbox field, use the exact option text. For a date field, use YYYY-MM-DD.'),
        })).min(1),
        actions: z.array(z.union([
          z.object({
            type: z.literal('setFieldVisibility'),
            fields: z.array(z.string().min(1)).min(1).describe('Target field labels or ids'),
            defaultState: z.enum(['hidden', 'visible']).describe('The target\'s state when these terms are NOT matching — see the tool description for how to derive this from "unless"/"except"/"when"/"if" phrasing.'),
          }),
          z.object({ type: z.enum(['requireField', 'unrequireField']), fields: z.array(z.string().min(1)).min(1).describe('Target field labels or ids') }),
          z.object({
            type: z.literal('setPageVisibility'),
            page: z.string().min(1).describe('Target page title or id'),
            defaultState: z.enum(['hidden', 'visible']).describe('Same derivation as setFieldVisibility.defaultState, applied to the page.'),
          }),
          z.object({ type: z.literal('skipToPage'), page: z.string().min(1).describe('Target page title or id') }),
        ])).min(1),
        rationale: z.string().min(1).describe('Brief explanation for the reviewer'),
      }),
      execute: async ({ combinator, terms, actions, rationale }) => {
        const resolvedTerms = [] as ConditionalRule['terms'];
        for (const term of terms) {
          const field = resolveField(workingSchema, term.field);
          if (!field) return { error: `I couldn't find a unique field matching "${term.field}". Please use the exact field label.` };
          const allowed = CONDITION_OPERATORS_BY_TYPE[normalizeFieldType(field.type)];
          if (!allowed) return { error: `"${field.label ?? term.field}" is a display-only or unsupported field and cannot trigger a condition.` };
          if (!allowed.includes(term.operator)) return { error: `"${term.operator}" is not valid for the ${field.label ?? term.field} field. Choose an operator supported by its field type.` };

          // The evaluator (conditions.ts) never reads array values for ANY field type — every
          // operator (equals/contains/lessThan/etc.) coerces a term value that isn't a plain
          // string/number to null and the term silently never matches. A rule built from an
          // array value would look configured but never fire, so reject it outright rather
          // than accepting a value shape nothing can evaluate.
          if (Array.isArray(term.value)) {
            return { error: `A condition value must be a single value, not a list. Choose one option for "${field.label ?? term.field}".` };
          }

          let resolvedValue = term.value;
          const fieldTypeToken = normalizeFieldType(field.type);
          if (resolvedValue !== undefined && ['select_field', 'radio_field', 'checkbox_field'].includes(fieldTypeToken)) {
            const options = ((field.options ?? []) as unknown[]).map(String);
            const match =
              options.find((option) => option === String(resolvedValue)) ??
              options.find((option) => normalizeLabel(option) === normalizeLabel(String(resolvedValue)));
            if (!match) return { error: `"${String(resolvedValue)}" is not one of the options for "${field.label ?? term.field}" (${options.join(', ')}).` };
            resolvedValue = match;
          } else if (resolvedValue !== undefined && fieldTypeToken === 'number_field') {
            // evaluateNumberTerm silently treats a non-finite value as "never matches" —
            // catch a non-numeric string here instead of creating a dead rule.
            const num = typeof resolvedValue === 'number' ? resolvedValue : Number(resolvedValue);
            if (!Number.isFinite(num)) return { error: `"${String(resolvedValue)}" is not a valid number for "${field.label ?? term.field}".` };
            resolvedValue = num;
          } else if (resolvedValue !== undefined && fieldTypeToken === 'date_field') {
            // Stored dates are plain 'YYYY-MM-DD' strings compared lexicographically
            // (conditions.ts evaluateDateTerm) — any other format never matches.
            const isoMatch = /^\d{4}-\d{2}-\d{2}/.exec(String(resolvedValue));
            if (!isoMatch) return { error: `"${String(resolvedValue)}" must be a date in YYYY-MM-DD format for "${field.label ?? term.field}".` };
            resolvedValue = isoMatch[0];
          }

          resolvedTerms.push({ fieldId: field.id, operator: term.operator, ...(resolvedValue !== undefined && { value: resolvedValue }) });
        }

        const resolvedActions: ConditionalRule['actions'] = [];
        for (const action of actions) {
          if (action.type === 'setFieldVisibility') {
            const fieldIds: string[] = [];
            for (const reference of action.fields) {
              const field = resolveField(workingSchema, reference);
              if (!field) return { error: `I couldn't find a unique target field matching "${reference}". Please use the exact field label.` };
              fieldIds.push(field.id);
            }
            // defaultState 'hidden' means the target is hidden until a showField rule matches;
            // 'visible' means it's shown until a hideField rule matches — see conditions.ts
            // evaluateConditions doc comment. The model states the outcome it wants (defaultState);
            // this is the single place that maps it to the actual stored action type, removing the
            // show/hide-verb judgement call that was previously left to the model and was the
            // dominant source of backwards ("hide unless") rules.
            resolvedActions.push({ type: action.defaultState === 'hidden' ? 'showField' : 'hideField', fieldIds });
          } else if ('fields' in action) {
            const fieldIds: string[] = [];
            for (const reference of action.fields) {
              const field = resolveField(workingSchema, reference);
              if (!field) return { error: `I couldn't find a unique target field matching "${reference}". Please use the exact field label.` };
              fieldIds.push(field.id);
            }
            resolvedActions.push({ type: action.type, fieldIds });
          } else {
            const matchingPages = (workingSchema.pages ?? []).filter((candidate: any) => candidate.id === action.page || normalizeLabel(String(candidate.title ?? '')) === normalizeLabel(action.page));
            if (matchingPages.length === 0) return { error: `I couldn't find a page matching "${action.page}". Please use the exact page title.` };
            if (matchingPages.length > 1) return { error: `"${action.page}" matches multiple pages. Please use the exact page title to disambiguate.` };
            const page = matchingPages[0];
            if (action.type === 'setPageVisibility') {
              resolvedActions.push({ type: action.defaultState === 'hidden' ? 'showPage' : 'hidePage', pageId: page.id });
            } else {
              resolvedActions.push({ type: 'skipToPage', pageId: page.id });
            }
          }
        }

        const rule = {
          id: `condition-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          enabled: true,
          combinator,
          terms: resolvedTerms,
          actions: resolvedActions,
        };
        // conditionalRuleSchema gives a clear final shape check; sanitizeConditions is the
        // non-negotiable trust boundary used by persisted conditional logic too.
        if (!conditionalRuleSchema.safeParse(rule).success) return { error: 'The proposed condition is invalid and was not created.' };
        const sanitized = sanitizeConditions([rule]);
        if (!sanitized?.[0]) return { error: 'The proposed condition did not pass validation and was not created.' };
        return { type: 'PROPOSE_CONDITION_RULE' as const, rule: sanitized[0], rationale };
      },
    }),

    listPlugins: tool({
      description:
        'List this form\'s integrations (plugins) in compact format: id|type|"name"|on/off. Call before updatePlugin/removePlugin.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!formId) return { summary: '0 integrations', plugins: [] };
        const rows = await prisma.formPlugin.findMany({
          where: { formId },
          select: { id: true, type: true, name: true, enabled: true },
          orderBy: { createdAt: 'asc' },
        });
        return {
          summary: `${rows.length} integration${rows.length !== 1 ? 's' : ''}`,
          plugins: rows.map((r) => `${r.id}|${r.type}|"${r.name}"|${r.enabled ? 'on' : 'off'}`),
        };
      },
    }),

    /**
     * AI tool: proposes a new integration (FormPlugin row) for user confirmation.
     * Unlike the content tools, an accepted proposal is applied via the createFormPlugin
     * GraphQL mutation on the frontend — plugins live in Postgres, not the Y.js doc.
     * Never auto-applied; config is validated per plugin type before proposing.
     */
    proposePlugin: tool({
      description:
        'PROPOSAL: create an integration that runs on form submission (webhook | email). Does NOT apply — user must confirm in the card. Provide only the config block matching pluginType. Reference form fields by visible label or id.',
      inputSchema: z.object({
        pluginType: z.enum(AI_PLUGIN_TYPES),
        name: z.string().min(1).max(100).describe('Short display name for the integration'),
        webhook: z.object({
          url: z.string().describe('HTTPS endpoint to POST submissions to'),
          secret: z.string().nullable().optional().describe('Optional signing secret'),
        }).optional(),
        email: z.object({
          recipientEmail: z.string().nullable().optional().describe('Static recipient address'),
          recipientField: z.string().nullable().optional().describe('Email field (label or id) whose answer becomes a recipient'),
          subject: z.string().min(1),
          message: z.string().min(1),
          sendToSubmitter: z.boolean().optional(),
        }).optional(),
        rationale: z.string().min(1).describe('Brief explanation for the reviewer'),
      }),
      execute: async ({ pluginType, name, webhook, email, rationale }) => {
        let config: Record<string, unknown>;

        if (pluginType === 'webhook') {
          if (!webhook?.url) return { error: 'The webhook config block with a url is required for pluginType "webhook".' };
          let parsed: URL;
          try { parsed = new URL(webhook.url); } catch { return { error: `"${webhook.url}" is not a valid URL.` }; }
          if (parsed.protocol !== 'https:') return { error: 'Webhook URLs must use https.' };
          config = { type: 'webhook', url: webhook.url, ...(webhook.secret ? { secret: webhook.secret } : {}) };
        } else {
          if (!email) return { error: 'The email config block is required for pluginType "email".' };
          // Mirrors EmailPluginConfig: at least one of recipientEmail / recipientFieldId is required.
          if (!email.recipientEmail && !email.recipientField) {
            return { error: 'Email integrations need recipientEmail, recipientField, or both.' };
          }
          if (email.recipientEmail && !EMAIL_REGEX.test(email.recipientEmail)) {
            return { error: `"${email.recipientEmail}" is not a valid email address.` };
          }
          config = { type: 'email', subject: email.subject, message: email.message };
          if (email.recipientEmail) config.recipientEmail = email.recipientEmail;
          if (email.sendToSubmitter !== undefined) config.sendToSubmitter = email.sendToSubmitter;
          if (email.recipientField) {
            const field = resolveField(workingSchema, email.recipientField);
            if (!field) return { error: `I couldn't find a unique field matching "${email.recipientField}". Please use the exact field label.` };
            if (normalizeFieldType(field.type) !== 'email_field') {
              return { error: `"${field.label ?? email.recipientField}" is not an email field, so it cannot supply the recipient address.` };
            }
            config.recipientFieldId = field.id;
            config.recipientFieldLabel = field.label;
          }
        }

        // 'form.submitted' is the only subscribable event today; plugin.test is internal.
        return { type: 'PROPOSE_CREATE_PLUGIN' as const, pluginType, name, config, events: ['form.submitted'], rationale };
      },
    }),

    updatePlugin: tool({
      description:
        'PROPOSAL: rename or enable/disable an existing integration. Does NOT apply — user must confirm. Get pluginId from listPlugins.',
      inputSchema: z.object({
        pluginId: z.string().min(1).describe('The plugin ID from listPlugins'),
        name: z.string().min(1).max(100).nullable().optional().describe('New display name; omit to keep'),
        enabled: z.boolean().nullable().optional().describe('true to enable, false to disable; omit to keep'),
        rationale: z.string().min(1).describe('Brief explanation for the reviewer'),
      }),
      execute: async ({ pluginId, name, enabled, rationale }) => {
        if (name == null && enabled == null) return { error: 'Nothing to change — provide name and/or enabled.' };
        if (!formId) return { error: 'Integrations are unavailable for this form.' };
        const plugin = await prisma.formPlugin.findFirst({ where: { id: pluginId, formId }, select: { id: true, type: true, name: true, enabled: true } });
        if (!plugin) return { error: `Integration ${pluginId} not found — call listPlugins for valid ids.` };
        return {
          type: 'PROPOSE_UPDATE_PLUGIN' as const,
          pluginId,
          pluginType: plugin.type,
          name: plugin.name,
          updates: { ...(name != null && { name }), ...(enabled != null && { enabled }) },
          rationale,
        };
      },
    }),

    removePlugin: tool({
      description:
        'PROPOSAL: delete an existing integration. Does NOT delete — user must confirm. Get pluginId from listPlugins.',
      inputSchema: z.object({
        pluginId: z.string().min(1).describe('The plugin ID from listPlugins'),
        rationale: z.string().min(1).describe('Brief explanation for the reviewer'),
      }),
      execute: async ({ pluginId, rationale }) => {
        if (!formId) return { error: 'Integrations are unavailable for this form.' };
        const plugin = await prisma.formPlugin.findFirst({ where: { id: pluginId, formId }, select: { id: true, type: true, name: true } });
        if (!plugin) return { error: `Integration ${pluginId} not found — call listPlugins for valid ids.` };
        return { type: 'PROPOSE_DELETE_PLUGIN' as const, pluginId, pluginType: plugin.type, name: plugin.name, rationale };
      },
    }),
  };

  // Conditional tool inclusion based on tier and form state:
  // - 'minimal': core CRUD only (addField, updateFields, addPage, navigateToPage, updateLayout)
  // - 'core': minimal + removeFields, renamePage, reorder, removePage
  // - 'full': all tools including proposals and relocation
  const minimalTools = {
    addField: mutationTools.addField,
    updateFields: mutationTools.updateFields,
    addPage: mutationTools.addPage,
    navigateToPage: mutationTools.navigateToPage,
    updateLayout: mutationTools.updateLayout,
  };

  const coreTools = {
    ...minimalTools,
    removeFields: mutationTools.removeFields,
    renamePage: mutationTools.renamePage,
    reorder: mutationTools.reorder,
    ...(totalPages > 1 ? { removePage: mutationTools.removePage } : {}),
  };

  const fullTools = {
    ...coreTools,
    ...(totalPages > 1 || totalFields > 0 ? { removePage: mutationTools.removePage } : {}),
    ...(totalFields > 0 ? { relocateField: mutationTools.relocateField } : {}),
    ...(totalFields > 2 ? { proposeValidation: mutationTools.proposeValidation } : {}),
    ...(totalFields > 0 ? { proposeFieldTypeChange: mutationTools.proposeFieldTypeChange } : {}),
    ...(totalFields > 0 ? { upsertConditionRule: mutationTools.upsertConditionRule } : {}),
    // Plugin tools are full-tier only AND OWNER-gated: automation has external side effects,
    // so it never rides the cheap default path, and it is never offered to callers who
    // couldn't pass createFormPlugin's own OWNER check anyway (no dead-end proposals).
    ...(canManagePlugins ? {
      listPlugins: mutationTools.listPlugins,
      proposePlugin: mutationTools.proposePlugin,
      updatePlugin: mutationTools.updatePlugin,
      removePlugin: mutationTools.removePlugin,
    } : {}),
  };

  const tieredTools = toolTier === 'minimal' ? minimalTools : toolTier === 'core' ? coreTools : fullTools;

  return {
    ...(includeReadTools ? readTools : {}),
    ...tieredTools,
  };
}

export type FormOperation =
  | { type: 'ADD_FIELD'; pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null }
  | { type: 'UPDATE_FIELDS'; fieldIds: string[]; updates: Record<string, unknown> }
  | { type: 'RELOCATE_FIELD'; fieldId: string; targetPageId: string; insertAfterFieldId: string | null; mode: 'move' | 'copy' }
  | { type: 'REORDER'; scope: 'fields' | 'pages'; ids: string[]; pageId?: string }
  | { type: 'UPDATE_LAYOUT'; content?: string; customCTAButtonName?: string }
  | { type: 'RENAME_PAGE'; pageId: string; newTitle: string }
  | { type: 'ADD_PAGE'; pageId: string; title: string; insertAfterPageId: string | null }
  | { type: 'NAVIGATE_TO_PAGE'; pageId: string }
  | { type: 'PROPOSE_VALIDATION'; suggestions: Array<{ fieldId: string; fieldLabel: string; fieldType: string; validation?: { minLength?: number | null; maxLength?: number | null; minSelections?: number | null; maxSelections?: number | null }; min?: number | null; max?: number | null; required?: boolean }>; rationale: string }
  | { type: 'PROPOSE_DELETE_FIELDS'; fields: Array<{ fieldId: string; label: string; responseCount: number }> }
  | { type: 'PROPOSE_DELETE_PAGE'; pageId: string; pageTitle: string; fieldCount: number; responseCount: number }
  | { type: 'PROPOSE_FIELD_TYPE_CHANGE'; fieldId: string; label: string; currentType: string; newFieldType: string; responseCount: number }
  | { type: 'PROPOSE_CONDITION_RULE'; rule: ConditionalRule; rationale: string }
  | { type: 'PROPOSE_CREATE_PLUGIN'; pluginType: 'webhook' | 'email'; name: string; config: Record<string, unknown>; events: string[]; rationale: string }
  | { type: 'PROPOSE_UPDATE_PLUGIN'; pluginId: string; pluginType: string; name: string; updates: { name?: string; enabled?: boolean }; rationale: string }
  | { type: 'PROPOSE_DELETE_PLUGIN'; pluginId: string; pluginType: string; name: string; rationale: string };
