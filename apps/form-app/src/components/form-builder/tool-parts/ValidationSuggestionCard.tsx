// apps/form-app/src/components/form-builder/tool-parts/ValidationSuggestionCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@dculus/ui';
import { msgVariants, easeOut } from '../aiChatMotion';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ValidationSuggestion } from '../../../store/types/store.types';

const ValidationSuggestionCard: React.FC = () => {
  const { t } = useTranslation('aiEditDrawer');
  const {
    pendingValidationSuggestions,
    acceptValidationSuggestion,
    dismissValidationSuggestion,
    updateField,
    pages,
  } = useFormBuilderStore();

  if (pendingValidationSuggestions.length === 0) return null;

  function applyUpdates(suggestion: ValidationSuggestion) {
    const pageId = pages.find((p) =>
      p.fields?.some((f) => f.id === suggestion.fieldId)
    )?.id;
    if (!pageId) return;
    const updates: Record<string, unknown> = {};
    if (suggestion.validation) updates.validation = suggestion.validation;
    if (suggestion.min != null) updates.min = suggestion.min;
    if (suggestion.max != null) updates.max = suggestion.max;
    if (suggestion.required != null) {
      updates.validation = { ...((updates.validation as Record<string, unknown>) ?? {}), required: suggestion.required };
    }
    updateField(pageId, suggestion.fieldId, updates as any);
  }

  const handleAccept = (fieldId: string) => {
    const suggestion = acceptValidationSuggestion(fieldId);
    if (suggestion) applyUpdates(suggestion);
  };

  const handleAcceptAll = () => {
    const all = [...pendingValidationSuggestions];
    all.forEach((s) => {
      applyUpdates(s);
      dismissValidationSuggestion(s.fieldId);
    });
  };

  return (
    <motion.div
      className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"
      variants={msgVariants}
      initial="hidden"
      animate="visible"
      transition={easeOut}
    >
      <p className="mb-2 font-medium text-blue-800">{t('validation.title')}</p>
      <div className="space-y-2">
        {pendingValidationSuggestions.map((s) => (
          <div
            key={s.fieldId}
            className="flex items-start justify-between gap-2 rounded border border-blue-100 bg-white p-2"
          >
            <div>
              <p className="font-medium text-blue-900 text-xs">
                "{s.fieldLabel}" ({s.fieldType})
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                {Object.entries({
                  ...(s.validation ?? {}),
                  ...(s.min != null ? { min: s.min } : {}),
                  ...(s.max != null ? { max: s.max } : {}),
                  ...(s.required != null ? { required: s.required } : {}),
                })
                  .filter(([, v]) => v != null)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="default"
                className="h-6 px-2 text-xs"
                onClick={() => handleAccept(s.fieldId)}
              >
                {t('validation.accept')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => dismissValidationSuggestion(s.fieldId)}
              >
                {t('validation.skip')}
              </Button>
            </div>
          </div>
        ))}
        <button
          className="text-xs text-blue-700 underline hover:text-blue-900"
          onClick={handleAcceptAll}
        >
          {t('validation.acceptAll')}
        </button>
      </div>
    </motion.div>
  );
};

export default ValidationSuggestionCard;
