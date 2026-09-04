import React, { useEffect } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@dculus/ui';
import { Plus, X, Loader2 } from 'lucide-react';
import type { FillableFormField } from '@dculus/types';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../store/useAutomationBuilderStore';
import { getOperatorOptions, renderFilterInput } from '../../Filters/FilterRow';
import { FilterFieldSelect, type FilterableField } from '../../Filters/FilterFieldSelect';
import { buildMetaFilterFields } from '../../Filters/metaFilterFields';
import type { FilterState } from '../../Filters/FilterPanel';
import { PREVIEW_PDF_GENERATOR_MATCH_COUNT } from '../../../graphql/pdfGenerators';
import type { ConditionRule } from './types';

interface DigestFiltersEditorProps {
  filters: ConditionRule[];
  fields: FillableFormField[];
  formId?: string;
  disabled: boolean;
  onChange: (filters: ConditionRule[]) => void;
}

// Matches the repo's one existing debounce convention (Responses.tsx's search box) — a plain
// setTimeout/useEffect, not a shared hook or lodash (neither exists elsewhere in this codebase).
const COUNT_DEBOUNCE_MS = 500;

/**
 * Filter rows for a digest node's additional narrowing filters — ANDed onto the mandatory
 * since-last-run window at execution time (engine.ts). Row rendering reuses FilterRow.tsx's
 * field/operator/value pieces directly, same as ConditionRulesEditor.tsx, so the three filter
 * UIs in this app (Responses page, condition nodes, digest nodes) can never drift apart on
 * which operators are offered per field type or how a value input renders.
 *
 * Also shows a live "N responses match" count, debounced 500ms after the last edit, via the
 * previewPdfGeneratorMatchCount query (already used for the PDF-templates matching-count UI,
 * generic on formId+filters — reused here with zero backend changes). The count is ALL-TIME,
 * not scoped to "since last run" (that boundary is dynamic per-run and only known at execution
 * time), so it's labeled accordingly — it's a filter sanity-check, not a preview of exactly what
 * the next run will fetch.
 */
export const DigestFiltersEditor: React.FC<DigestFiltersEditorProps> = ({
  filters,
  fields,
  formId,
  disabled,
  onChange,
}) => {
  const { t } = useTranslation('automations');
  const { t: tFilter } = useTranslation('filterRow');
  const quizEnabled = useAutomationBuilderStore((s) => s.quizEnabled);

  // Digest filters run through the SQL-backed responseService.getResponsesByFormId (see
  // engine.ts's fetchDigestResponses), unlike ConditionRulesEditor's trigger-time rules —
  // so the full meta-filter registry applies here, not just the trigger-payload quiz fields.
  const metaFields = buildMetaFilterFields({ quizEnabled });

  const [fetchCount, { data: countData, loading: countLoading, error: countError }] = useLazyQuery(
    PREVIEW_PDF_GENERATOR_MATCH_COUNT
  );

  useEffect(() => {
    if (!formId) return;
    const complete = filters.every((f) => f.fieldId && f.operator);
    if (!complete) return; // an in-progress row (field picked, operator not yet chosen) isn't queryable yet

    const timer = setTimeout(() => {
      fetchCount({ variables: { formId, filters, filterLogic: 'AND' } });
    }, COUNT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // Deliberately depends on a serialized `filters` rather than the array reference itself —
    // a new array reference is created on every parent re-render, which would re-fire the
    // debounce timer on every keystroke elsewhere in the panel, not just on an actual filter edit.
  }, [formId, JSON.stringify(filters), fetchCount]);

  const setFilters = (next: ConditionRule[]) => onChange(next);

  const handleAddFilter = () => setFilters([...filters, { fieldId: '', operator: '' }]);
  const handleRemoveFilter = (index: number) => setFilters(filters.filter((_, i) => i !== index));
  const handleFilterChange = (index: number, patch: Partial<ConditionRule>) =>
    setFilters(filters.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const handleFieldChange = (index: number, fieldId: string) =>
    handleFilterChange(index, { fieldId, operator: '', value: undefined, values: undefined, dateRange: undefined, numberRange: undefined });

  const handleOperatorChange = (index: number, operator: string) => {
    const defaultValue = operator === 'DATE_LAST_N_DAYS' ? '7' : undefined;
    handleFilterChange(index, { operator, value: defaultValue, values: undefined, dateRange: undefined, numberRange: undefined });
  };

  const matchCount: number | undefined = countData?.previewPdfGeneratorMatchCount;

  return (
    <div className="space-y-3">
      <Label>{t('builder.panel.digest.filtersLabel')}</Label>
      {filters.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('builder.panel.digest.noFiltersHint')}</p>
      )}

      <div className="space-y-3">
        {filters.map((filter, index) => {
          const formField = fields.find((f) => f.id === filter.fieldId);
          const metaField = !formField ? metaFields.find((m) => m.id === filter.fieldId) : undefined;
          const field: FilterableField | undefined = formField ?? metaField;
          const operatorOptions = field ? getOperatorOptions(field, tFilter) : [];
          const filterState: FilterState = {
            fieldId: filter.fieldId,
            operator: filter.operator,
            value: filter.value,
            values: filter.values,
            dateRange: filter.dateRange,
            numberRange: filter.numberRange,
            active: true,
          };

          return (
            <fieldset
              key={index}
              disabled={disabled}
              className="p-3 rounded-lg space-y-2.5"
              style={{ border: '1px solid var(--tf-border-medium)' }}
              data-testid="digest-filter-row"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{t('builder.panel.condition.and')}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleRemoveFilter(index)}
                  aria-label={t('builder.panel.condition.removeRule')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <FilterFieldSelect
                fields={fields}
                metaFields={metaFields}
                value={filter.fieldId || ''}
                onChange={(fieldId) => handleFieldChange(index, fieldId)}
                t={tFilter}
                triggerClassName="h-9"
                testId="digest-filter-field-select"
              />

              {field && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={filter.operator || ''} onValueChange={(operator) => handleOperatorChange(index, operator)}>
                    <SelectTrigger className="h-9 min-w-[140px]" data-testid="digest-filter-operator-select">
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

                  {filter.operator && (
                    <div className="flex-1 min-w-[140px]" data-testid="digest-filter-value-container">
                      {renderFilterInput(
                        field,
                        filterState,
                        (patch) => {
                          const rest: Partial<FilterState> = { ...patch };
                          delete rest.active;
                          handleFilterChange(index, rest);
                        },
                        tFilter,
                        formId
                      )}
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleAddFilter}
        disabled={disabled}
        data-testid="digest-add-filter"
      >
        <Plus className="h-3.5 w-3.5" />
        {t('builder.panel.digest.addFilter')}
      </Button>

      {formId && (countLoading || countError || matchCount !== undefined) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="digest-match-count">
          {countLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('builder.panel.digest.matchCountLoading')}
            </>
          ) : countError ? (
            t('builder.panel.digest.matchCountError')
          ) : (
            t('builder.panel.digest.matchCount', { values: { count: matchCount ?? 0 } })
          )}
        </div>
      )}
    </div>
  );
};
