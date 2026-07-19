import { FieldType, sanitizeConditions } from '@dculus/types';
import type { FormBuilderState } from '../store/types/store.types';
import { getApiBaseUrl } from './config';

function invalidateSchema(formId: string): void {
  fetch(`${getApiBaseUrl()}/api/ai/invalidate-schema`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ formId }),
  }).catch(() => { /* fire-and-forget, ignore failures */ });
}

const AI_TYPE_MAP: Record<string, FieldType> = {
  // Short forms used by addField tool
  text: FieldType.TEXT_INPUT_FIELD,
  textarea: FieldType.TEXT_AREA_FIELD,
  email: FieldType.EMAIL_FIELD,
  number: FieldType.NUMBER_FIELD,
  date: FieldType.DATE_FIELD,
  select: FieldType.SELECT_FIELD,
  radio: FieldType.RADIO_FIELD,
  checkbox: FieldType.CHECKBOX_FIELD,
  file: FieldType.FILE_UPLOAD_FIELD,
  phone: FieldType.PHONE_NUMBER_FIELD,
  // Full store type names used by copyField (sourceField.type from Y.js)
  text_input_field: FieldType.TEXT_INPUT_FIELD,
  TEXT_INPUT_FIELD: FieldType.TEXT_INPUT_FIELD,
  text_area_field: FieldType.TEXT_AREA_FIELD,
  TEXT_AREA_FIELD: FieldType.TEXT_AREA_FIELD,
  email_field: FieldType.EMAIL_FIELD,
  EMAIL_FIELD: FieldType.EMAIL_FIELD,
  number_field: FieldType.NUMBER_FIELD,
  NUMBER_FIELD: FieldType.NUMBER_FIELD,
  date_field: FieldType.DATE_FIELD,
  DATE_FIELD: FieldType.DATE_FIELD,
  select_field: FieldType.SELECT_FIELD,
  SELECT_FIELD: FieldType.SELECT_FIELD,
  radio_field: FieldType.RADIO_FIELD,
  RADIO_FIELD: FieldType.RADIO_FIELD,
  checkbox_field: FieldType.CHECKBOX_FIELD,
  CHECKBOX_FIELD: FieldType.CHECKBOX_FIELD,
  file_upload_field: FieldType.FILE_UPLOAD_FIELD,
  FILE_UPLOAD_FIELD: FieldType.FILE_UPLOAD_FIELD,
  phone_number_field: FieldType.PHONE_NUMBER_FIELD,
  PHONE_NUMBER_FIELD: FieldType.PHONE_NUMBER_FIELD,
};

const CHOICE_TYPES = new Set([FieldType.SELECT_FIELD, FieldType.RADIO_FIELD, FieldType.CHECKBOX_FIELD]);

/** Returns the pageId that contains the given fieldId, or null if not found. */
function findPageForField(pages: any[], fieldId: string): string | null {
  for (const page of pages) {
    if ((page.fields ?? []).some((f: any) => f.id === fieldId)) return page.id;
  }
  return null;
}

/**
 * Applies a single AI operation to the form builder store.
 *
 * Mutation ops (ADD_FIELD, UPDATE_FIELDS, etc.) are applied immediately.
 * Proposal ops (PROPOSE_*) are enqueued as pending actions/suggestions and
 * require explicit user acceptance — they never mutate the form directly.
 * After any mutation the backend schema cache is invalidated via `invalidateSchema`.
 */
export function applyAIOp(
  op: any,
  store: Pick<
    FormBuilderState,
    | 'pages' | 'addField' | 'addFieldAtIndex' | 'updateField' | 'removeField'
    | 'reorderFields' | 'updateLayout' | 'updatePageTitle' | 'reorderPages'
    | 'addPageAtPosition' | 'removePage' | 'setSelectedPage'
    | 'setAIHighlightedFieldId' | 'setPendingValidationSuggestions' | 'addPendingConditionSuggestion'
    | 'moveFieldBetweenPages' | 'addPendingDestructiveAction'
  >,
  formId?: string,
  toolCallId?: string
): void {
  if (!op?.type) return;

  switch (op.type) {
    case 'ADD_FIELD': {
      const targetPageId: string | undefined = (store.pages as any[]).find((p: any) => p.id === op.pageId)?.id;
      if (!targetPageId) {
        console.warn('[applyAIOp] ADD_FIELD: pageId not found in store, skipping', op.pageId);
        break;
      }

      const fieldType = AI_TYPE_MAP[op.fieldType] ?? FieldType.TEXT_INPUT_FIELD;
      const isChoice = CHOICE_TYPES.has(fieldType);
      const fieldData = {
        label: op.label,
        required: op.required ?? false,
        placeholder: op.placeholder ?? '',
        defaultValue: '',
        prefix: '',
        hint: '',
        ...(isChoice && { options: op.options ?? ['Option 1', 'Option 2'] }),
      };

      if (op.insertAfterFieldId) {
        const page = (store.pages as any[]).find((p: any) => p.id === targetPageId);
        const idx = (page?.fields ?? []).findIndex((f: any) => f.id === op.insertAfterFieldId);
        if (idx !== -1) {
          store.addFieldAtIndex(targetPageId, fieldType, fieldData, idx + 1);
          // highlight the newly inserted field (now at idx+1)
          const updatedPage = (store.pages as any[]).find((p: any) => p.id === targetPageId);
          const newFieldId = updatedPage?.fields?.[idx + 1]?.id;
          if (newFieldId) {
            store.setAIHighlightedFieldId(newFieldId);
            setTimeout(() => store.setAIHighlightedFieldId(null), 2000);
          }
          break;
        }
      }
      store.addField(targetPageId, fieldType, fieldData);
      // highlight the last field on the page (the one just added)
      const updatedPage = (store.pages as any[]).find((p: any) => p.id === targetPageId);
      const fields = updatedPage?.fields ?? [];
      const newFieldId = fields[fields.length - 1]?.id;
      if (newFieldId) {
        store.setAIHighlightedFieldId(newFieldId);
        setTimeout(() => store.setAIHighlightedFieldId(null), 2000);
      }
      break;
    }

    case 'UPDATE_FIELDS': {
      const fieldIds: string[] = op.fieldIds ?? [];
      let lastUpdatedId: string | null = null;
      for (const fieldId of fieldIds) {
        const pageId = findPageForField(store.pages, fieldId);
        if (pageId) {
          store.updateField(pageId, fieldId, op.updates);
          lastUpdatedId = fieldId;
        }
      }
      // Highlight the last successfully updated field (single edit = 1-elem array)
      if (lastUpdatedId) {
        store.setAIHighlightedFieldId(lastUpdatedId);
        setTimeout(() => store.setAIHighlightedFieldId(null), 2000);
      }
      break;
    }

    // ── Destructive proposals: DO NOT mutate. Enqueue for user confirmation. ──
    case 'PROPOSE_DELETE_FIELDS': {
      const fields = (op.fields ?? []).filter((f: any) => findPageForField(store.pages, f.fieldId));
      if (fields.length === 0) break;
      const id = toolCallId ?? `delete-fields-${fields.map((f: any) => f.fieldId).join(',')}`;
      store.addPendingDestructiveAction({ id, kind: 'delete-fields', fields });
      break; // no schema invalidation — nothing changed yet
    }

    case 'PROPOSE_DELETE_PAGE': {
      const exists = (store.pages as any[]).some((p: any) => p.id === op.pageId);
      if (!exists) break;
      const id = toolCallId ?? `delete-page-${op.pageId}`;
      store.addPendingDestructiveAction({
        id,
        kind: 'delete-page',
        pageId: op.pageId,
        pageTitle: op.pageTitle ?? 'Untitled page',
        fieldCount: op.fieldCount ?? 0,
        responseCount: op.responseCount ?? 0,
      });
      break;
    }

    case 'PROPOSE_FIELD_TYPE_CHANGE': {
      const pageId = findPageForField(store.pages, op.fieldId);
      if (!pageId) break;
      const id = toolCallId ?? `convert-${op.fieldId}-${op.newFieldType}`;
      store.addPendingDestructiveAction({
        id,
        kind: 'convert',
        fieldId: op.fieldId,
        label: op.label ?? op.fieldId,
        currentType: op.currentType ?? '',
        newFieldType: op.newFieldType,
        responseCount: op.responseCount ?? 0,
      });
      break;
    }

    case 'REORDER': {
      if (op.scope === 'pages') {
        const desired: string[] = op.ids ?? [];
        const current: string[] = (store.pages as any[]).map((p: any) => p.id);
        for (let i = 0; i < desired.length; i++) {
          const fromIdx = current.indexOf(desired[i]);
          if (fromIdx !== -1 && fromIdx !== i) {
            store.reorderPages(fromIdx, i);
            const [moved] = current.splice(fromIdx, 1);
            current.splice(i, 0, moved);
          }
        }
      } else {
        // scope === 'fields'
        const page = (store.pages as any[]).find((p: any) => p.id === op.pageId);
        if (!page) break;
        const current: string[] = (page.fields ?? []).map((f: any) => f.id);
        const desired: string[] = op.ids ?? [];
        for (let i = 0; i < desired.length; i++) {
          const fromIdx = current.indexOf(desired[i]);
          if (fromIdx !== -1 && fromIdx !== i) {
            store.reorderFields(op.pageId, fromIdx, i);
            const [moved] = current.splice(fromIdx, 1);
            current.splice(i, 0, moved);
          }
        }
      }
      break;
    }

    case 'UPDATE_LAYOUT': {
      // Whitelist only the fields the AI updateLayout tool exposes.
      // If the tool schema grows, add the new fields here too.
      const updates: Record<string, unknown> = {};
      if (op.content !== undefined) updates.content = op.content;
      if (op.customCTAButtonName !== undefined) updates.customCTAButtonName = op.customCTAButtonName;
      store.updateLayout(updates);
      break;
    }

    case 'RENAME_PAGE': {
      const pageExists = (store.pages as any[]).some((p: any) => p.id === op.pageId);
      if (!pageExists) return;
      store.updatePageTitle(op.pageId, op.newTitle);
      break;
    }

    case 'ADD_PAGE': {
      // Pass the pre-generated pageId from the backend so subsequent ADD_FIELD ops
      // can reference the new page by the same ID the AI already knows.
      store.addPageAtPosition(op.title ?? 'New Page', op.insertAfterPageId ?? null, op.pageId);
      break;
    }

    case 'RELOCATE_FIELD': {
      if (op.mode === 'copy') {
        // Reconstruct fieldData from source field and add a copy on the target page.
        let sourceField: any = null;
        for (const page of store.pages as any[]) {
          sourceField = (page.fields ?? []).find((f: any) => f.id === op.fieldId) ?? null;
          if (sourceField) break;
        }
        if (!sourceField) break;

        const targetPage = (store.pages as any[]).find((p: any) => p.id === op.targetPageId);
        if (!targetPage) break;

        const fieldType = AI_TYPE_MAP[sourceField.type] ?? FieldType.TEXT_INPUT_FIELD;
        const isChoice = CHOICE_TYPES.has(fieldType);
        const fieldData = {
          label: sourceField.label,
          required: sourceField.required ?? false,
          placeholder: sourceField.placeholder ?? '',
          defaultValue: '',
          prefix: '',
          hint: sourceField.hint ?? '',
          ...(isChoice && { options: sourceField.options ?? [] }),
        };

        if (op.insertAfterFieldId) {
          const idx = (targetPage.fields ?? []).findIndex((f: any) => f.id === op.insertAfterFieldId);
          if (idx !== -1) {
            store.addFieldAtIndex(op.targetPageId, fieldType, fieldData, idx + 1);
            break;
          }
        }
        store.addField(op.targetPageId, fieldType, fieldData);
        break;
      }

      // mode === 'move'
      const sourcePageId = findPageForField(store.pages, op.fieldId);
      if (!sourcePageId) break;

      const targetPage = (store.pages as any[]).find((p: any) => p.id === op.targetPageId);
      if (!targetPage) break;

      let insertIndex: number | undefined;
      if (op.insertAfterFieldId) {
        const idx = (targetPage.fields ?? []).findIndex((f: any) => f.id === op.insertAfterFieldId);
        if (idx !== -1) insertIndex = idx + 1;
      }

      store.moveFieldBetweenPages(sourcePageId, op.targetPageId, op.fieldId, insertIndex);
      break;
    }

    case 'NAVIGATE_TO_PAGE': {
      const pageExists = (store.pages as any[]).some((p: any) => p.id === op.pageId);
      if (pageExists) store.setSelectedPage(op.pageId);
      break;
    }

    case 'PROPOSE_VALIDATION': {
      store.setPendingValidationSuggestions(op.suggestions ?? []);
      break;
    }

    case 'PROPOSE_CONDITION_RULE': {
      // Treat streamed AI output as untrusted even though the backend validates it.
      // Nothing reaches the conditions slice until an explicit user acceptance.
      const rule = sanitizeConditions([op.rule])?.[0];
      if (!rule) break;
      store.addPendingConditionSuggestion({
        id: toolCallId ?? rule.id,
        rule,
        rationale: typeof op.rationale === 'string' ? op.rationale : '',
      });
      break;
    }

    default: {
      // Defensive no-op: legacy op types from old conversations are never
      // re-applied (applyAIOp only runs on live tool calls), but guard anyway.
      break;
    }
  }

  // Invalidate backend schema cache after any mutation. Proposal ops (validation + destructive
  // confirmations) do not mutate the form yet, so they skip invalidation — the real mutation
  // happens on Accept (DestructiveActionCard / ValidationSuggestionCard) which invalidates then.
  const PROPOSAL_OPS = new Set([
    'PROPOSE_VALIDATION',
    'PROPOSE_DELETE_FIELDS',
    'PROPOSE_DELETE_PAGE',
    'PROPOSE_FIELD_TYPE_CHANGE',
    'PROPOSE_CONDITION_RULE',
  ]);
  if (formId && !PROPOSAL_OPS.has(op.type)) invalidateSchema(formId);
}
