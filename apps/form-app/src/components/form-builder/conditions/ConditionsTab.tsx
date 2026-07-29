import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { GitBranch, Plus, Sparkles, X } from 'lucide-react';
import { Badge, Button, Input, toastSuccess } from '@dculus/ui';
import { ConditionalRule } from '@dculus/types';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useTranslation } from '../../../hooks/useTranslation';
import { useConditionCycles } from '../../../hooks/useConditionCycles';
import { getRulesForField } from '../../../utils/getRulesForField';
import { ConditionRuleCard } from './ConditionRuleCard';
import { ConditionRuleEditor } from './ConditionRuleEditor';
import { fieldDisplayLabel } from './conditionFieldConfig';

export const ConditionsTab: React.FC<{ onDescribeWithAI: (description: string) => void }> = ({ onDescribeWithAI }) => {
  const { t } = useTranslation('conditions');
  const {
    pages,
    conditions,
    addCondition,
    updateCondition,
    removeCondition,
    setConditionEnabled,
    pendingConditionSuggestions,
    acceptConditionSuggestion,
    dismissConditionSuggestion,
  } = useFormBuilderStore();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ConditionalRule | null>(null);
  const [description, setDescription] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Same gate as field/page editing — viewers see rules read-only
  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();

  const circularRuleIds = useConditionCycles(conditions, pages);

  // Deep-link filter from the field logic-summary row: /builder/logic?ruleField=<id>.
  // Deliberately NOT `field` — the Content tab's own selection URL sync
  // (useBuilderSelectionUrlSync) already writes `?screen=page:<id>&field=<fieldId>`,
  // and TabNavigation preserves location.search across tab switches. Reusing
  // `field` here would silently filter the rule list for anyone who merely had a
  // field selected in Content and then clicked the Logic tab.
  const filterFieldId = searchParams.get('ruleField');
  const filterField = useMemo(
    () => (filterFieldId ? pages.flatMap((page) => page.fields).find((f) => f.id === filterFieldId) : undefined),
    [pages, filterFieldId]
  );
  const filteredConditions = useMemo(() => {
    if (!filterFieldId) return conditions;
    return getRulesForField(conditions, filterFieldId);
  }, [conditions, filterFieldId]);

  const clearFieldFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('ruleField');
    setSearchParams(next, { replace: true });
  };

  const openCreate = () => {
    setEditingRule(null);
    setEditorOpen(true);
  };

  const openEdit = (rule: ConditionalRule) => {
    setEditingRule(rule);
    setEditorOpen(true);
  };

  const handleSave = (rule: ConditionalRule) => {
    if (editingRule) {
      updateCondition(rule.id, rule);
    } else {
      addCondition(rule);
    }
    toastSuccess(t('toast.ruleSaved'));
  };

  const handleDelete = (ruleId: string) => {
    removeCondition(ruleId);
    toastSuccess(t('toast.ruleDeleted'));
  };

  const submitDescription = () => {
    const value = description.trim();
    if (!value) return;
    setDescription('');
    onDescribeWithAI(value);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-xl">
              <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white" data-testid="conditions-title">
                {t('title')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
          </div>
          {canEdit && (
            <Button onClick={openCreate} data-testid="condition-add-rule">
              <Plus className="h-4 w-4 mr-1.5" />
              {t('addRule')}
            </Button>
          )}
        </div>

        {filterFieldId && (
          <Badge
            variant="outline"
            data-testid="condition-field-filter-chip"
            className="w-fit gap-1.5 px-2.5 py-1 text-xs font-medium"
          >
            {t('fieldFilter.label', {
              values: { field: filterField ? fieldDisplayLabel(filterField) : t('fieldFilter.unknownField') },
            })}
            <button
              type="button"
              onClick={clearFieldFilter}
              data-testid="condition-field-filter-clear"
              aria-label={t('fieldFilter.clear')}
              className="ml-0.5 rounded-full hover:bg-accent"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}

        {canEdit && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/20">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-violet-950 dark:text-violet-100">
              <Sparkles className="h-4 w-4" />
              {t('ai.title')}
            </div>
            <div className="flex gap-2">
              <Input value={description} onChange={(event) => setDescription(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter') submitDescription();
              }} placeholder={t('ai.placeholder')} data-testid="condition-ai-description" />
              <Button onClick={submitDescription} disabled={!description.trim()} data-testid="condition-ai-submit">
                {t('ai.generate')}
              </Button>
            </div>
          </div>
        )}

        {pendingConditionSuggestions.map((suggestion) => (
          <div key={suggestion.id} className="rounded-xl border border-violet-200 bg-violet-50 p-4" data-testid={`condition-suggestion-${suggestion.id}`}>
            <p className="font-medium text-violet-950">{t('ai.suggestionTitle')}</p>
            <p className="mt-1 text-sm text-violet-800">{suggestion.rationale}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={!canEdit} onClick={() => {
                if (!canEdit) return;
                const accepted = acceptConditionSuggestion(suggestion.id);
                if (accepted) addCondition(accepted.rule);
              }} data-testid={`condition-suggestion-accept-${suggestion.id}`}>
                {t('ai.accept')}
              </Button>
              <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => {
                if (!canEdit) return;
                dismissConditionSuggestion(suggestion.id);
              }} data-testid={`condition-suggestion-dismiss-${suggestion.id}`}>
                {t('ai.dismiss')}
              </Button>
            </div>
          </div>
        ))}

        {conditions.length === 0 ? (
          <div
            className="border border-dashed rounded-xl py-16 text-center space-y-2"
            data-testid="conditions-empty-state"
          >
            <GitBranch className="h-8 w-8 mx-auto text-muted-foreground" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              {t('empty.title')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t('empty.description')}
            </p>
          </div>
        ) : filteredConditions.length === 0 ? (
          <div
            className="border border-dashed rounded-xl py-16 text-center space-y-2"
            data-testid="conditions-filter-empty-state"
          >
            <GitBranch className="h-8 w-8 mx-auto text-muted-foreground" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              {t('fieldFilter.emptyTitle')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t('fieldFilter.emptyDescription')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConditions.map((rule) => (
              <ConditionRuleCard
                key={rule.id}
                rule={rule}
                pages={pages}
                canEdit={canEdit}
                isCircular={circularRuleIds.has(rule.id)}
                onEdit={() => openEdit(rule)}
                onDelete={() => handleDelete(rule.id)}
                onToggleEnabled={(enabled) => setConditionEnabled(rule.id, enabled)}
              />
            ))}
          </div>
        )}
      </div>

      <ConditionRuleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        pages={pages}
        initialRule={editingRule}
        onSave={handleSave}
      />
    </div>
  );
};
