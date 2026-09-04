import React from 'react';
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from '@dculus/ui';
import { Plus, X } from 'lucide-react';
import type { FillableFormField } from '@dculus/types';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../store/useAutomationBuilderStore';
import { getOperatorOptions, renderFilterInput } from '../../Filters/FilterRow';
import { FilterFieldSelect, type FilterableField } from '../../Filters/FilterFieldSelect';
import { TRIGGER_QUIZ_META_FIELDS } from '../../Filters/metaFilterFields';
import type { FilterState } from '../../Filters/FilterPanel';
import type { AutomationConditionNodeData, ConditionCombinator, ConditionRule } from './types';

interface ConditionRulesEditorProps {
  nodeId: string;
  data: AutomationConditionNodeData;
  fields: FillableFormField[];
  disabled: boolean;
}

/**
 * Rule rows for a ConditionNode's config panel (#200): field picker (fillable fields from
 * the form schema) → operator dropdown (filtered by field type) → type-appropriate value
 * input, plus an AND/OR combinator toggle across all rows. Persists exactly the
 * `{ rules, combinator }` shape evaluateCondition (#193) consumes.
 *
 * The field-picker/operator/value pieces are reused directly from the Responses filter UI
 * (FilterRow.tsx) rather than reimplemented, so the two can never drift out of sync on which
 * operators are offered per field type or how each value input renders.
 */
export const ConditionRulesEditor: React.FC<ConditionRulesEditorProps> = ({ nodeId, data, fields, disabled }) => {
  const { t } = useTranslation('automations');
  const { t: tFilter } = useTranslation('filterRow');
  const updateNodeData = useAutomationBuilderStore((s) => s.updateNodeData);
  const quizEnabled = useAutomationBuilderStore((s) => s.quizEnabled);
  const triggerType = useAutomationBuilderStore((s) => s.triggerType);

  // Trigger-context quiz fields only exist in the form.submitted event payload
  // (emitFormSubmitted's quizFanout) — see metaFilterFields.ts's TRIGGER_QUIZ_META_FIELDS
  // doc comment for why these use different fieldIds from the Responses-page __grade* set.
  const metaFields = quizEnabled && triggerType === 'form.submitted' ? TRIGGER_QUIZ_META_FIELDS : [];

  const rules = data.rules ?? [];
  const combinator: ConditionCombinator = data.combinator ?? 'AND';

  const setRules = (nextRules: ConditionRule[]) => updateNodeData(nodeId, { rules: nextRules });

  const handleAddRule = () => {
    setRules([...rules, { fieldId: '', operator: '' }]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, patch: Partial<ConditionRule>) => {
    setRules(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const handleFieldChange = (index: number, fieldId: string) => {
    handleRuleChange(index, {
      fieldId,
      operator: '',
      value: undefined,
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
    });
  };

  const handleOperatorChange = (index: number, operator: string) => {
    const defaultValue = operator === 'DATE_LAST_N_DAYS' ? '7' : undefined;
    handleRuleChange(index, {
      operator,
      value: defaultValue,
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
    });
  };

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{t('builder.panel.condition.rulesLabel')}</Label>
        {rules.length > 1 && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={combinator}
            onValueChange={(value) => value && updateNodeData(nodeId, { combinator: value as ConditionCombinator })}
          >
            <ToggleGroupItem value="AND" className="text-xs px-2.5 h-7" data-testid="condition-combinator-and">
              {t('builder.panel.condition.and')}
            </ToggleGroupItem>
            <ToggleGroupItem value="OR" className="text-xs px-2.5 h-7" data-testid="condition-combinator-or">
              {t('builder.panel.condition.or')}
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('builder.panel.condition.noRulesHint')}</p>
      )}

      <div className="space-y-3">
        {rules.map((rule, index) => {
          const formField = fields.find((f) => f.id === rule.fieldId);
          const metaField = !formField ? metaFields.find((m) => m.id === rule.fieldId) : undefined;
          const field: FilterableField | undefined = formField ?? metaField;
          const operatorOptions = field ? getOperatorOptions(field, tFilter) : [];
          const filterState: FilterState = {
            fieldId: rule.fieldId,
            operator: rule.operator,
            value: rule.value,
            values: rule.values,
            dateRange: rule.dateRange,
            numberRange: rule.numberRange,
            active: true,
          };

          return (
            <div
              key={index}
              className="p-3 rounded-lg space-y-2.5"
              style={{ border: '1px solid var(--tf-border-medium)' }}
              data-testid="condition-rule-row"
            >
              <div className="flex items-center justify-between">
                {index > 0 ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    {combinator === 'AND' ? t('builder.panel.condition.and') : t('builder.panel.condition.or')}
                  </span>
                ) : (
                  <span />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleRemoveRule(index)}
                  aria-label={t('builder.panel.condition.removeRule')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <FilterFieldSelect
                fields={fields}
                metaFields={metaFields}
                value={rule.fieldId || ''}
                onChange={(fieldId) => handleFieldChange(index, fieldId)}
                t={tFilter}
                triggerClassName="h-9"
                testId="condition-field-select"
              />

              {field && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={rule.operator || ''} onValueChange={(operator) => handleOperatorChange(index, operator)}>
                    <SelectTrigger className="h-9 min-w-[140px]" data-testid="condition-operator-select">
                      <SelectValue placeholder={tFilter('placeholders.selectCondition')} />
                    </SelectTrigger>
                    <SelectContent>
                      {operatorOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {rule.operator && (
                    <div className="flex-1 min-w-[140px]" data-testid="condition-value-container">
                      {renderFilterInput(
                        field,
                        filterState,
                        (patch) => {
                          // renderFilterInput's onChange only sets the keys it actually
                          // changed (plus fieldId/operator context) — forward everything
                          // except `active`, which is FilterPanel-only and not part of
                          // ConditionRule's persisted shape.
                          const rest: Partial<FilterState> = { ...patch };
                          delete rest.active;
                          handleRuleChange(index, rest);
                        },
                        tFilter
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAddRule} data-testid="condition-add-rule">
        <Plus className="h-3.5 w-3.5" />
        {t('builder.panel.condition.addRule')}
      </Button>
    </fieldset>
  );
};
