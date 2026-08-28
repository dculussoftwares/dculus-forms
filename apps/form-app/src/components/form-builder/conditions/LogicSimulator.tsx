import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, PlayCircle, RotateCcw, Asterisk } from 'lucide-react';
import {
  Button,
  DatePicker,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import {
  ConditionalRule,
  FieldType,
  FormPage,
  FormResponsesByPage,
  evaluateConditions,
} from '@dculus/types';
import { formatCalendarDate, parseCalendarDate, cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { getTriggerFieldOptions, fieldDisplayLabel } from './conditionFieldConfig';
import { LogicIndex, fieldVisual, resolveFieldRef, resolvePageRef } from './logicVisuals';
import { FieldRefChip, PageRefChip } from './RefChips';

interface LogicSimulatorProps {
  pages: FormPage[];
  conditions: ConditionalRule[];
  index: LogicIndex;
}

/**
 * Answer the trigger fields, see what the respondent would get.
 *
 * Until now the only way to check what a rule actually does was to leave the tab,
 * open Preview, and fill the form by hand — once per branch you wanted to verify.
 * This runs the *same* `evaluateConditions` the viewer runs, so what it reports is
 * what respondents get; there is no second implementation of the semantics here.
 */
export const LogicSimulator: React.FC<LogicSimulatorProps> = ({ pages, conditions, index }) => {
  const { t } = useTranslation('conditions');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  // Only fields some rule actually triggers on are worth asking about — the rest
  // cannot change the outcome.
  const triggerFields = useMemo(() => {
    const triggerIds = new Set(conditions.flatMap((rule) => rule.terms.map((term) => term.fieldId)));
    return getTriggerFieldOptions(pages).filter((option) => triggerIds.has(option.field.id));
  }, [pages, conditions]);

  const responses: FormResponsesByPage = useMemo(() => {
    const byPage: FormResponsesByPage = {};
    for (const page of pages) {
      const pageAnswers: Record<string, unknown> = {};
      for (const field of page.fields) {
        if (field.id in answers) pageAnswers[field.id] = answers[field.id];
      }
      byPage[page.id] = pageAnswers;
    }
    return byPage;
  }, [pages, answers]);

  const result = useMemo(
    () => evaluateConditions(conditions, responses, { pages }),
    [conditions, responses, pages]
  );

  const hiddenFields = useMemo(
    () =>
      Array.from(result.hiddenFieldIds).filter((fieldId) => index.fieldById.has(fieldId)),
    [result, index]
  );
  const hiddenPages = useMemo(
    () => Array.from(result.hiddenPageIds).filter((pageId) => index.pageById.has(pageId)),
    [result, index]
  );
  const requiredNow = useMemo(
    () =>
      Array.from(result.requiredOverrides.entries())
        .filter(([fieldId, required]) => required && index.fieldById.has(fieldId))
        .map(([fieldId]) => fieldId),
    [result, index]
  );

  const setAnswer = (fieldId: string, value: unknown) =>
    setAnswers((current) => ({ ...current, [fieldId]: value }));

  const renderAnswerInput = (field: (typeof triggerFields)[number]['field']) => {
    const value = answers[field.id];
    const options = (field as { options?: string[] }).options ?? [];

    if (
      field.type === FieldType.SELECT_FIELD ||
      field.type === FieldType.RADIO_FIELD ||
      field.type === FieldType.CHECKBOX_FIELD
    ) {
      return (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={(next) =>
            setAnswer(field.id, field.type === FieldType.CHECKBOX_FIELD ? [next] : next)
          }
        >
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder={t('simulator.noAnswer')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === FieldType.DATE_FIELD) {
      const isIso = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
      return (
        <DatePicker
          date={isIso ? parseCalendarDate(value) : undefined}
          onDateChange={(date?: Date) =>
            setAnswer(field.id, date ? formatCalendarDate(date) : undefined)
          }
          placeholder={t('simulator.noAnswer')}
        />
      );
    }

    if (field.type === FieldType.NUMBER_FIELD) {
      return (
        <Input
          type="number"
          className="h-10 text-sm"
          placeholder={t('simulator.noAnswer')}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) =>
            setAnswer(field.id, event.target.value === '' ? undefined : Number(event.target.value))
          }
        />
      );
    }

    return (
      <Input
        className="h-10 text-sm"
        placeholder={t('simulator.noAnswer')}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => setAnswer(field.id, event.target.value)}
      />
    );
  };

  if (conditions.length === 0) return null;

  return (
    <div
      className="space-y-4 px-5 py-5"
      style={{ borderTop: '1px solid var(--tf-border)' }}
      data-testid="logic-simulator"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-[var(--tf-dark)] dark:text-gray-100">
            <PlayCircle className="h-4 w-4" />
            {t('simulator.title')}
          </h3>
          <p className="mt-1 text-sm text-[var(--tf-muted)] dark:text-gray-400">
            {t('simulator.subtitle')}
          </p>
        </div>
        {Object.keys(answers).length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            onClick={() => setAnswers({})}
            data-testid="logic-simulator-reset"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            {t('simulator.reset')}
          </Button>
        )}
      </div>

      {triggerFields.length === 0 ? (
        <p className="text-sm text-[var(--tf-muted)] dark:text-gray-400">
          {t('simulator.noTriggers')}
        </p>
      ) : (
        <div className="space-y-2">
          {triggerFields.map(({ field }) => {
            const visual = fieldVisual(field);
            return (
              <div key={field.id} className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--tf-text)] dark:text-gray-300">
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                      visual.tileClass
                    )}
                  >
                    <visual.Icon className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 truncate">{fieldDisplayLabel(field)}</span>
                </div>
                {renderAnswerInput(field)}
              </div>
            );
          })}
        </div>
      )}

      {/* Outcome */}
      <div className="space-y-3 rounded-lg bg-[var(--tf-faint)] p-4 dark:bg-gray-800/60">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--tf-muted)] dark:text-gray-400">
          {t('simulator.outcome')}
        </p>

        {hiddenFields.length === 0 && hiddenPages.length === 0 && requiredNow.length === 0 ? (
          <p
            className="flex items-center gap-1.5 text-sm text-[var(--tf-muted)] dark:text-gray-400"
            data-testid="logic-simulator-outcome-empty"
          >
            <Eye className="h-4 w-4" />
            {t('simulator.everythingVisible')}
          </p>
        ) : (
          <div className="space-y-2" data-testid="logic-simulator-outcome">
            {hiddenFields.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--tf-muted)] dark:text-gray-400">
                  <EyeOff className="h-3 w-3" />
                  {t('simulator.hiddenFields', { values: { count: hiddenFields.length } })}
                </p>
                <div className="flex flex-wrap gap-1">
                  {hiddenFields.map((fieldId) => (
                    <FieldRefChip
                      key={fieldId}
                      reference={resolveFieldRef(index, fieldId, t('card.deletedField'))}
                      showPage={pages.length > 1}
                    />
                  ))}
                </div>
              </div>
            )}

            {hiddenPages.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--tf-muted)] dark:text-gray-400">
                  <EyeOff className="h-3 w-3" />
                  {t('simulator.hiddenPages', { values: { count: hiddenPages.length } })}
                </p>
                <div className="flex flex-wrap gap-1">
                  {hiddenPages.map((pageId) => (
                    <PageRefChip
                      key={pageId}
                      reference={resolvePageRef(index, pageId, t('card.deletedPage'), (n) =>
                        t('editor.page', { values: { number: n } })
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {requiredNow.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--tf-muted)] dark:text-gray-400">
                  <Asterisk className="h-3 w-3" />
                  {t('simulator.requiredFields', { values: { count: requiredNow.length } })}
                </p>
                <div className="flex flex-wrap gap-1">
                  {requiredNow.map((fieldId) => (
                    <FieldRefChip
                      key={fieldId}
                      reference={resolveFieldRef(index, fieldId, t('card.deletedField'))}
                      showPage={pages.length > 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
