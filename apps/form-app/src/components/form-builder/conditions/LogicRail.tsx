import React from 'react';
import { AlertTriangle, LayoutList, PauseCircle, Plus, Search, X } from 'lucide-react';
import { Button, Input, ScrollArea } from '@dculus/ui';
import { ConditionAction, FormPage } from '@dculus/types';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { ACTION_TONE, actionToneClass } from './logicVisuals';

export type RuleFilter = 'all' | 'issues' | 'disabled';

export interface LogicRailProps {
  canEdit: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  filter: RuleFilter;
  onFilterChange: (filter: RuleFilter) => void;
  actionTypeFilter: ConditionAction['type'] | null;
  onActionTypeFilterChange: (type: ConditionAction['type'] | null) => void;
  pageFilter: string | null;
  onPageFilterChange: (pageId: string | null) => void;
  /** Set by the ?ruleField= deep link from Content; cleared from here. */
  fieldFilterLabel: string | null;
  onClearFieldFilter: () => void;
  counts: {
    all: number;
    issues: number;
    disabled: number;
    byActionType: Map<ConditionAction['type'], number>;
    byPage: Map<string, number>;
  };
  pages: FormPage[];
  onAddRule: () => void;
}

/**
 * The Logic tab's left column: find the rule you mean.
 *
 * The tab previously rendered every rule in one undifferentiated chronological
 * column with no search, sort, or grouping — fine at two rules, unusable at
 * twenty, which is exactly where a form with real branching ends up. This rail
 * also becomes the home of the `?ruleField=` deep link arriving from Content, so
 * a field filter reads as one filter among several rather than a floating chip
 * above the list.
 */
export const LogicRail: React.FC<LogicRailProps> = ({
  canEdit,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  actionTypeFilter,
  onActionTypeFilterChange,
  pageFilter,
  onPageFilterChange,
  fieldFilterLabel,
  onClearFieldFilter,
  counts,
  pages,
  onAddRule,
}) => {
  const { t } = useTranslation('conditions');

  const filterRow = (
    id: RuleFilter,
    label: string,
    count: number,
    Icon: React.ElementType | null
  ) => (
    <button
      key={id}
      type="button"
      onClick={() => onFilterChange(id)}
      data-testid={`logic-filter-${id}`}
      aria-pressed={filter === id}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
        filter === id
          ? 'bg-[var(--tf-faint)] font-medium text-[var(--tf-dark)] dark:bg-gray-800 dark:text-gray-100'
          : 'text-[var(--tf-muted)] hover:bg-[var(--tf-faint)] hover:text-[var(--tf-dark)] dark:text-gray-400 dark:hover:bg-gray-800'
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-xs tabular-nums text-[var(--tf-light-muted)] dark:text-gray-500">
        {count}
      </span>
    </button>
  );

  const actionTypes = Array.from(counts.byActionType.entries()).filter(([, count]) => count > 0);

  return (
    <div
      data-testid="logic-rail"
      className="flex h-full w-[260px] shrink-0 flex-col overflow-hidden bg-white dark:bg-card"
      style={{ borderRight: '1px solid var(--tf-border)' }}
    >
      {canEdit && (
        <div className="p-4 pb-2.5">
          <Button className="h-10 w-full justify-center text-sm" onClick={onAddRule} data-testid="condition-add-rule">
            <Plus className="mr-1.5 h-4 w-4" />
            {t('addRule')}
          </Button>
        </div>
      )}

      <div className={cn('px-4', canEdit ? 'pb-2.5' : 'pt-4 pb-2.5')}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('rail.searchPlaceholder')}
            data-testid="logic-search"
            className="h-10 pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 px-4 pb-5">
          {fieldFilterLabel && (
            <div
              className="mb-2 flex items-center gap-1.5 rounded-lg border border-[var(--tf-border-medium)] bg-[var(--tf-faint)] px-2.5 py-2 dark:border-gray-700 dark:bg-gray-800"
              data-testid="condition-field-filter-chip"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--tf-dark)] dark:text-gray-100">
                {t('fieldFilter.label', { values: { field: fieldFilterLabel } })}
              </span>
              <button
                type="button"
                onClick={onClearFieldFilter}
                data-testid="condition-field-filter-clear"
                aria-label={t('fieldFilter.clear')}
                className="shrink-0 rounded-full p-0.5 hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {filterRow('all', t('rail.all'), counts.all, LayoutList)}
          {counts.issues > 0 && filterRow('issues', t('rail.issues'), counts.issues, AlertTriangle)}
          {counts.disabled > 0 &&
            filterRow('disabled', t('rail.disabled'), counts.disabled, PauseCircle)}

          {actionTypes.length > 0 && (
            <>
              <p className="mt-4 px-2.5 pb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--tf-light-muted)] dark:text-gray-500">
                {t('rail.byAction')}
              </p>
              {actionTypes.map(([type, count]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onActionTypeFilterChange(actionTypeFilter === type ? null : type)}
                  aria-pressed={actionTypeFilter === type}
                  data-testid={`logic-filter-action-${type}`}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    actionTypeFilter === type
                      ? 'bg-[var(--tf-faint)] font-medium text-[var(--tf-dark)] dark:bg-gray-800 dark:text-gray-100'
                      : 'text-[var(--tf-muted)] hover:bg-[var(--tf-faint)] hover:text-[var(--tf-dark)] dark:text-gray-400 dark:hover:bg-gray-800'
                  )}
                >
                  <span
                    className={cn(
                      'h-2.5 w-2.5 shrink-0 rounded-full border',
                      actionToneClass(ACTION_TONE[type])
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{t(`actions.${type}`)}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--tf-light-muted)] dark:text-gray-500">
                    {count}
                  </span>
                </button>
              ))}
            </>
          )}

          {pages.length > 1 && (
            <>
              <p className="mt-4 px-2.5 pb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--tf-light-muted)] dark:text-gray-500">
                {t('rail.byPage')}
              </p>
              {pages.map((page, pageIndex) => {
                const count = counts.byPage.get(page.id) ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => onPageFilterChange(pageFilter === page.id ? null : page.id)}
                    aria-pressed={pageFilter === page.id}
                    data-testid={`logic-filter-page-${page.id}`}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      pageFilter === page.id
                        ? 'bg-[var(--tf-faint)] font-medium text-[var(--tf-dark)] dark:bg-gray-800 dark:text-gray-100'
                        : 'text-[var(--tf-muted)] hover:bg-[var(--tf-faint)] hover:text-[var(--tf-dark)] dark:text-gray-400 dark:hover:bg-gray-800'
                    )}
                  >
                    <span className="w-4 shrink-0 text-center text-xs font-semibold tabular-nums text-[var(--tf-muted)]">
                      {pageIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {page.title || t('editor.page', { values: { number: pageIndex + 1 } })}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--tf-light-muted)] dark:text-gray-500">
                      {count}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
