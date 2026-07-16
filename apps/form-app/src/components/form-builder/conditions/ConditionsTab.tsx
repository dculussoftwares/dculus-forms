import React, { useState } from 'react';
import { GitBranch, Plus } from 'lucide-react';
import { Button, toastSuccess } from '@dculus/ui';
import { ConditionalRule } from '@dculus/types';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { ConditionRuleCard } from './ConditionRuleCard';
import { ConditionRuleEditor } from './ConditionRuleEditor';

export const ConditionsTab: React.FC = () => {
  const { t } = useTranslation('conditions');
  const {
    pages,
    conditions,
    addCondition,
    updateCondition,
    removeCondition,
    setConditionEnabled,
  } = useFormBuilderStore();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ConditionalRule | null>(null);

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

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-xl">
              <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('title')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
          </div>
          <Button onClick={openCreate} data-testid="condition-add-rule">
            <Plus className="h-4 w-4 mr-1.5" />
            {t('addRule')}
          </Button>
        </div>

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
        ) : (
          <div className="space-y-3">
            {conditions.map((rule) => (
              <ConditionRuleCard
                key={rule.id}
                rule={rule}
                pages={pages}
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
