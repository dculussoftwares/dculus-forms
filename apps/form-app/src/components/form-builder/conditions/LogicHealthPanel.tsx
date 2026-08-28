import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  EyeOff,
  PauseCircle,
  Repeat,
  Wrench,
} from 'lucide-react';
import { Badge } from '@dculus/ui';
import { ConditionalRule } from '@dculus/types';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { LogicIssue, LogicHealth } from '../../../hooks/useLogicHealth';
import { LogicIndex, resolveFieldRef } from './logicVisuals';

interface LogicHealthPanelProps {
  health: LogicHealth;
  index: LogicIndex;
  rules: ConditionalRule[];
  canEdit: boolean;
  onSelectRule: (ruleId: string) => void;
  /** Strips dangling references from the rule, or deletes it if nothing survives. */
  onCleanupRule: (ruleId: string) => void;
}

const ISSUE_ICON: Record<LogicIssue['kind'], React.ElementType> = {
  brokenReference: AlertTriangle,
  circular: Repeat,
  backwardReference: ArrowRight,
  unreachableField: EyeOff,
};

/**
 * Whole-form logic problems in one place, each naming its specifics.
 *
 * Previously these existed only as per-card badges: you had to scroll every rule
 * to learn there was a problem, and "Broken reference" never told you *which*
 * field broke — you opened the editor and hunted. Each row here resolves the
 * offending field/page/option by name and selects the responsible rule on click.
 */
export const LogicHealthPanel: React.FC<LogicHealthPanelProps> = ({
  health,
  index,
  rules,
  canEdit,
  onSelectRule,
  onCleanupRule,
}) => {
  const { t } = useTranslation('conditions');

  const describe = (issue: LogicIssue): string => {
    const missingLabel = t('card.deletedField');
    switch (issue.kind) {
      case 'brokenReference': {
        const parts: string[] = [];
        const fieldIds = issue.detail.missingFieldIds ?? [];
        const pageIds = issue.detail.missingPageIds ?? [];
        const stale = issue.detail.staleOptionValues ?? [];
        if (fieldIds.length > 0) {
          parts.push(t('health.missingFields', { values: { count: fieldIds.length } }));
        }
        if (pageIds.length > 0) {
          parts.push(t('health.missingPages', { values: { count: pageIds.length } }));
        }
        for (const entry of stale) {
          const reference = resolveFieldRef(index, entry.fieldId, missingLabel, t('chip.untitledField'));
          parts.push(
            t('health.staleOption', { values: { value: entry.value, field: reference.label } })
          );
        }
        return parts.join(' · ');
      }
      case 'circular':
        return t('health.circularDetail', { values: { count: issue.ruleIds.length } });
      case 'backwardReference':
        return t('card.backwardReferenceHint');
      case 'unreachableField': {
        const reference = resolveFieldRef(index, issue.detail.fieldId ?? '', missingLabel, t('chip.untitledField'));
        return t('health.unreachableDetail', { values: { field: reference.label } });
      }
    }
  };

  const severity = (kind: LogicIssue['kind']) =>
    kind === 'brokenReference' || kind === 'unreachableField' ? 'error' : 'warning';

  return (
    <div className="space-y-4 px-5 py-5" data-testid="logic-health-panel">
      <div>
        <h3 className="text-base font-semibold text-[var(--tf-dark)] dark:text-gray-100">
          {t('health.title')}
        </h3>
        <p className="mt-1 text-sm text-[var(--tf-muted)] dark:text-gray-400">
          {t('health.subtitle')}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="gap-1 text-xs">
          {t('health.activeRules', { values: { count: health.enabledCount } })}
        </Badge>
        {health.disabledCount > 0 && (
          <Badge variant="outline" className="gap-1 text-xs">
            <PauseCircle className="h-3 w-3" />
            {t('health.disabledRules', { values: { count: health.disabledCount } })}
          </Badge>
        )}
      </div>

      {health.issues.length === 0 ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-[var(--tf-green-bg-md)] bg-[var(--tf-green-bg)] p-3 dark:border-emerald-900 dark:bg-emerald-950/30"
          data-testid="logic-health-clean"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tf-green)] dark:text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-[var(--tf-green)] dark:text-emerald-300">
              {rules.length === 0 ? t('health.noRulesTitle') : t('health.allClearTitle')}
            </p>
            <p className="mt-1 text-xs text-[var(--tf-muted)] dark:text-gray-400">
              {rules.length === 0 ? t('health.noRulesBody') : t('health.allClearBody')}
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {health.issues.map((issue, issueIndex) => {
            const Icon = ISSUE_ICON[issue.kind];
            const isError = severity(issue.kind) === 'error';
            return (
              <li key={`${issue.kind}-${issueIndex}`}>
                <button
                  type="button"
                  onClick={() => issue.ruleIds[0] && onSelectRule(issue.ruleIds[0])}
                  data-testid={`logic-health-issue-${issue.kind}`}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
                    isError
                      ? 'border-[var(--tf-error-bg-lg)] bg-[var(--tf-error-bg)] hover:bg-[var(--tf-error-bg-md)] dark:border-red-900 dark:bg-red-950/25 dark:hover:bg-red-950/40'
                      : 'border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/25 dark:hover:bg-amber-950/40'
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      isError
                        ? 'text-[var(--tf-error)] dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-sm font-semibold',
                        isError
                          ? 'text-[var(--tf-error)] dark:text-red-300'
                          : 'text-amber-800 dark:text-amber-300'
                      )}
                    >
                      {t(`health.kind.${issue.kind}`)}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--tf-muted)] dark:text-gray-400">
                      {describe(issue)}
                    </span>
                  </span>
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-[var(--tf-light-muted)]" />
                </button>

                {/* A dangling reference is the one issue with a mechanical repair:
                    drop the parts that point at nothing. Everything else needs a
                    judgement call, so those rows only navigate to the rule. */}
                {issue.kind === 'brokenReference' && canEdit && issue.ruleIds[0] && (
                  <button
                    type="button"
                    onClick={() => onCleanupRule(issue.ruleIds[0])}
                    data-testid={`logic-health-cleanup-${issue.ruleIds[0]}`}
                    className="mt-1.5 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--tf-error)] hover:bg-[var(--tf-error-bg-md)] dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    {t('health.cleanup')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
