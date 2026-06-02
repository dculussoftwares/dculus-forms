// apps/form-app/src/components/form-builder/tool-parts/DestructiveActionCard.tsx
import React from 'react';
import { Button } from '@dculus/ui';
import { FieldType } from '@dculus/types';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks/useTranslation';
import type { DestructiveAction } from '../../../store/types/store.types';

// AI short field-type tokens → FieldType enum (for conversion).
const TOKEN_TO_FIELD_TYPE: Record<string, FieldType> = {
  text: FieldType.TEXT_INPUT_FIELD,
  textarea: FieldType.TEXT_AREA_FIELD,
  email: FieldType.EMAIL_FIELD,
  number: FieldType.NUMBER_FIELD,
  date: FieldType.DATE_FIELD,
  select: FieldType.SELECT_FIELD,
  radio: FieldType.RADIO_FIELD,
  checkbox: FieldType.CHECKBOX_FIELD,
  file: FieldType.FILE_UPLOAD_FIELD,
};

/**
 * Confirmation card for destructive AI proposals (delete field(s), delete page, convert type).
 * The AI only proposes; nothing is mutated until the user clicks Confirm here. Mirrors
 * ValidationSuggestionCard. After applying, it invalidates the backend schema cache so the AI's
 * next turn sees the updated form.
 */
const DestructiveActionCard: React.FC = () => {
  const { t } = useTranslation('aiEditDrawer');
  const store = useFormBuilderStore();
  const {
    pendingDestructiveActions,
    acceptDestructiveAction,
    dismissDestructiveAction,
  } = store;

  if (pendingDestructiveActions.length === 0) return null;

  const apply = (action: DestructiveAction) => {
    const formId = (store as any).formId as string | undefined;

    if (action.kind === 'delete-fields') {
      for (const f of action.fields) {
        const pageId = store.pages.find((p) => p.fields?.some((ff) => ff.id === f.fieldId))?.id;
        if (pageId) store.removeField(pageId, f.fieldId);
      }
    } else if (action.kind === 'delete-page') {
      if (store.pages.length > 1 && store.pages.some((p) => p.id === action.pageId)) {
        store.removePage(action.pageId);
      }
    } else {
      // convert
      const pageId = store.pages.find((p) => p.fields?.some((ff) => ff.id === action.fieldId))?.id;
      const newType = TOKEN_TO_FIELD_TYPE[action.newFieldType] ?? FieldType.TEXT_INPUT_FIELD;
      if (pageId) store.convertFieldType(pageId, action.fieldId, newType);
    }

    // Real mutation happened — refresh the AI's cached schema (fire-and-forget).
    if (formId) {
      const apiUrl = import.meta.env.VITE_API_URL as string;
      fetch(`${apiUrl}/api/ai/invalidate-schema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ formId }),
      }).catch(() => { /* ignore */ });
    }
  };

  const handleConfirm = (id: string) => {
    const action = acceptDestructiveAction(id);
    if (action) apply(action);
  };

  const renderBody = (action: DestructiveAction) => {
    if (action.kind === 'delete-fields') {
      return (
        <>
          <p className="font-medium text-red-900 text-xs">{t('destructive.deleteFieldsTitle')}</p>
          <ul className="mt-1 space-y-0.5">
            {action.fields.map((f) => (
              <li key={f.fieldId} className="text-xs text-red-700">
                • "{f.label}" —{' '}
                {t('destructive.responsesAffected', { values: { count: f.responseCount } })}
              </li>
            ))}
          </ul>
        </>
      );
    }
    if (action.kind === 'delete-page') {
      return (
        <>
          <p className="font-medium text-red-900 text-xs">
            {t('destructive.deletePageTitle', { values: { title: action.pageTitle } })}
          </p>
          <p className="mt-0.5 text-xs text-red-700">
            {t('destructive.deletePageDetail', {
              values: { fields: action.fieldCount, responses: action.responseCount },
            })}
          </p>
        </>
      );
    }
    // convert
    return (
      <>
        <p className="font-medium text-red-900 text-xs">
          {t('destructive.convertTitle', {
            values: { label: action.label, from: action.currentType, to: action.newFieldType },
          })}
        </p>
        <p className="mt-0.5 text-xs text-red-700">
          {t('destructive.convertDetail', { values: { count: action.responseCount } })}
        </p>
      </>
    );
  };

  return (
    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
      <p className="mb-2 font-medium text-red-800">⚠ {t('destructive.title')}</p>
      <div className="space-y-2">
        {pendingDestructiveActions.map((action) => (
          <div
            key={action.id}
            className="rounded border border-red-100 bg-white p-2"
          >
            <div className="min-w-0">{renderBody(action)}</div>
            <div className="mt-2 flex justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => dismissDestructiveAction(action.id)}
              >
                {t('destructive.cancel')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-6 px-2 text-xs"
                onClick={() => handleConfirm(action.id)}
              >
                {t('destructive.confirm')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DestructiveActionCard;
