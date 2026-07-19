import { tool } from 'ai';
import { z } from 'zod';
import { conditionalRuleSchema, sanitizeConditions, type ConditionOperator, type ConditionalRule } from '@dculus/types';
import { countResponsesPerField, countResponsesReferencingAnyField } from '../services/responseService.js';

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

const normalizeFieldType = (type: unknown): string => String(type ?? '').toLowerCase();
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

export function createFormEditTools(
  schema: { pages: any[] },
  opts?: { includeReadTools?: boolean; formId?: string; toolTier?: ToolTier }
) {
  const includeReadTools = opts?.includeReadTools !== false;
  const formId = opts?.formId;
  const toolTier = opts?.toolTier ?? 'full';
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
        const pageId = `page-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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

    upsertConditionRule: tool({
      description:
        'PROPOSAL: turn a described condition into ONE ready-to-review rule. Never apply it directly. Terms may identify trigger fields by their visible label or id; targets may identify fields/pages by label/title or id. Use only operators appropriate for each trigger field type. Rich text/display-only fields cannot be triggers.',
      inputSchema: z.object({
        combinator: z.enum(['any', 'all']),
        terms: z.array(z.object({
          field: z.string().min(1).describe('Trigger field label or id'),
          operator: z.enum(['equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'isEmpty', 'isFilled', 'lessThan', 'greaterThan', 'before', 'after']),
          value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
        })).min(1),
        actions: z.array(z.union([
          z.object({ type: z.enum(['showField', 'hideField', 'requireField', 'unrequireField']), fields: z.array(z.string().min(1)).min(1).describe('Target field labels or ids') }),
          z.object({ type: z.enum(['showPage', 'hidePage', 'skipToPage']), page: z.string().min(1).describe('Target page title or id') }),
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
          resolvedTerms.push({ fieldId: field.id, operator: term.operator, ...(term.value !== undefined && { value: term.value }) });
        }

        const resolvedActions: ConditionalRule['actions'] = [];
        for (const action of actions) {
          if ('fields' in action) {
            const fieldIds: string[] = [];
            for (const reference of action.fields) {
              const field = resolveField(workingSchema, reference);
              if (!field) return { error: `I couldn't find a unique target field matching "${reference}". Please use the exact field label.` };
              fieldIds.push(field.id);
            }
            if (action.type === 'showField' || action.type === 'hideField') {
              resolvedActions.push({ type: action.type, fieldIds });
            } else {
              resolvedActions.push({ type: action.type as 'requireField' | 'unrequireField', fieldIds });
            }
          } else {
            const page = (workingSchema.pages ?? []).find((candidate: any) => candidate.id === action.page || normalizeLabel(String(candidate.title ?? '')) === normalizeLabel(action.page));
            if (!page) return { error: `I couldn't find a page matching "${action.page}". Please use the exact page title.` };
            if (action.type === 'showPage' || action.type === 'hidePage' || action.type === 'skipToPage') {
              resolvedActions.push({ type: action.type, pageId: page.id });
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
  | { type: 'PROPOSE_CONDITION_RULE'; rule: ConditionalRule; rationale: string };
