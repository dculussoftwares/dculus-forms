import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { GitBranch, GripHorizontal, Sparkles } from 'lucide-react';
import { Button, Input, ScrollArea, toastSuccess } from '@dculus/ui';
import { ConditionAction, ConditionalRule } from '@dculus/types';
import { generateId, cn } from '@dculus/utils';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useTranslation } from '../../../hooks/useTranslation';
import { cleanupRuleReferences, useLogicHealth } from '../../../hooks/useLogicHealth';
import { getRulesForField } from '../../../utils/getRulesForField';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { ConditionRuleCard } from './ConditionRuleCard';
import { RuleInspector, type RuleDraftSeed } from './RuleInspector';
import { LogicRail, type RuleFilter } from './LogicRail';
import { LogicHealthPanel } from './LogicHealthPanel';
import { LogicSimulator } from './LogicSimulator';
import { RecipeGallery } from './RecipeGallery';
import { fieldDisplayLabel } from './conditionFieldConfig';
import { buildLogicIndex, ruleActionTypes, ruleTriggerPageId } from './logicVisuals';
import { buildRuleSentence } from './ruleSentence';

/** Panel-open state: a rule being edited, a brand-new draft, or nothing. */
type InspectorState =
  | { mode: 'closed' }
  | { mode: 'edit'; rule: ConditionalRule }
  | { mode: 'create'; seed: RuleDraftSeed | null };

/**
 * The Logic workspace.
 *
 * Replaces a centered 768px column of monochrome text cards with the same
 * rail / canvas / inspector shell the Content tab uses, so the two halves of the
 * builder finally read as one product. See docs/form-builder-redesign.md §3 —
 * the Logic tab was explicitly deferred when Content was redesigned, which is why
 * it was the last surface still on raw gray styling.
 */
export const ConditionsTab: React.FC<{ onDescribeWithAI: (description: string) => void }> = ({
  onDescribeWithAI,
}) => {
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

  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();

  const [inspector, setInspector] = useState<InspectorState>({ mode: 'closed' });
  const [description, setDescription] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ConditionalRule | null>(null);
  const [inspectorWidth, setInspectorWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RuleFilter>('all');
  const [actionTypeFilter, setActionTypeFilter] = useState<ConditionAction['type'] | null>(null);
  const [pageFilter, setPageFilter] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const index = useMemo(() => buildLogicIndex(pages), [pages]);
  const health = useLogicHealth(conditions, pages);

  // Deep-link filter from the field logic-summary row and the rail's ⚡ badge:
  // /builder/logic?ruleField=<id>. Deliberately NOT `field` — the Content tab's
  // own selection URL sync writes `?screen=…&field=…` and TabNavigation preserves
  // location.search across tab switches, so reusing `field` would silently filter
  // this list for anyone who merely had a field selected in Content.
  const filterFieldId = searchParams.get('ruleField');
  const filterField = useMemo(
    () =>
      filterFieldId
        ? pages.flatMap((page) => page.fields).find((field) => field.id === filterFieldId)
        : undefined,
    [pages, filterFieldId]
  );

  const clearFieldFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('ruleField');
    setSearchParams(next, { replace: true });
  };

  // ── Filtering ────────────────────────────────────────────────────────────
  const searchText = useMemo(() => {
    const map = new Map<string, string>();
    for (const rule of conditions) {
      map.set(rule.id, buildRuleSentence(rule, index, t).toLowerCase());
    }
    return map;
  }, [conditions, index, t]);

  const visibleRules = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return conditions.filter((rule) => {
      if (filterFieldId && !getRulesForField([rule], filterFieldId).length) return false;
      if (filter === 'issues' && !health.ruleIdsWithIssues.has(rule.id)) return false;
      if (filter === 'disabled' && rule.enabled) return false;
      if (actionTypeFilter && !ruleActionTypes(rule).includes(actionTypeFilter)) return false;
      if (pageFilter && ruleTriggerPageId(rule, index) !== pageFilter) return false;
      if (normalizedQuery && !(searchText.get(rule.id) ?? '').includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [
    conditions,
    filterFieldId,
    filter,
    actionTypeFilter,
    pageFilter,
    query,
    health,
    index,
    searchText,
  ]);

  const counts = useMemo(() => {
    const byActionType = new Map<ConditionAction['type'], number>();
    const byPage = new Map<string, number>();
    for (const rule of conditions) {
      for (const type of ruleActionTypes(rule)) {
        byActionType.set(type, (byActionType.get(type) ?? 0) + 1);
      }
      const pageId = ruleTriggerPageId(rule, index);
      if (pageId) byPage.set(pageId, (byPage.get(pageId) ?? 0) + 1);
    }
    return {
      all: conditions.length,
      issues: health.ruleIdsWithIssues.size,
      disabled: health.disabledCount,
      byActionType,
      byPage,
    };
  }, [conditions, health, index]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const handleSave = (rule: ConditionalRule) => {
    if (inspector.mode === 'edit') updateCondition(rule.id, rule);
    else addCondition(rule);
    toastSuccess(t('toast.ruleSaved'));
    setInspector({ mode: 'closed' });
  };

  const handleDuplicate = (rule: ConditionalRule) => {
    // Structured-clone the arrays so the copy never shares term/action objects
    // with the original — they are pushed straight into the Y.js document.
    addCondition({
      ...rule,
      id: generateId(),
      terms: rule.terms.map((term) => ({ ...term })),
      actions: rule.actions.map((action) => ({ ...action })),
    });
    toastSuccess(t('toast.ruleDuplicated'));
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    removeCondition(pendingDelete.id);
    if (inspector.mode === 'edit' && inspector.rule.id === pendingDelete.id) {
      setInspector({ mode: 'closed' });
    }
    setPendingDelete(null);
    toastSuccess(t('toast.ruleDeleted'));
  };

  const submitDescription = () => {
    const value = description.trim();
    if (!value) return;
    setDescription('');
    onDescribeWithAI(value);
  };

  const selectRuleById = useCallback(
    (ruleId: string) => {
      const rule = conditions.find((candidate) => candidate.id === ruleId);
      if (rule) setInspector({ mode: 'edit', rule });
    },
    [conditions]
  );

  const handleCleanupRule = useCallback(
    (ruleId: string) => {
      const rule = conditions.find((candidate) => candidate.id === ruleId);
      if (!rule) return;
      const { rule: cleaned, wouldBeEmpty } = cleanupRuleReferences(rule, pages);
      // Saving a rule with no terms or no actions would leave an inert husk the
      // evaluator skips and the author can't interpret — offer deletion instead.
      if (wouldBeEmpty) {
        setPendingDelete(rule);
        return;
      }
      updateCondition(ruleId, cleaned);
      toastSuccess(t('toast.ruleCleaned'));
    },
    [conditions, pages, updateCondition, t]
  );

  const allVisibleEnabled = visibleRules.length > 0 && visibleRules.every((rule) => rule.enabled);
  const toggleAllVisible = () => {
    for (const rule of visibleRules) setConditionEnabled(rule.id, !allVisibleEnabled);
  };

  // Resize handle — same interaction as the Content tab's right sidebar.
  const handleResizeStart = useCallback(
    (event: React.MouseEvent) => {
      setIsResizing(true);
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = inspectorWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = startX - moveEvent.clientX;
        setInspectorWidth(Math.max(280, Math.min(600, startWidth + deltaX)));
      };
      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [inspectorWidth]
  );

  const hasActiveFilter =
    Boolean(query.trim()) || filter !== 'all' || Boolean(actionTypeFilter) || Boolean(pageFilter);

  return (
    <div className="flex h-full min-h-0 bg-[var(--tf-faint)] dark:bg-gray-950">
      <LogicRail
        canEdit={canEdit}
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        actionTypeFilter={actionTypeFilter}
        onActionTypeFilterChange={setActionTypeFilter}
        pageFilter={pageFilter}
        onPageFilterChange={setPageFilter}
        fieldFilterLabel={
          filterFieldId
            ? filterField
              ? fieldDisplayLabel(filterField)
              : t('fieldFilter.unknownField')
            : null
        }
        onClearFieldFilter={clearFieldFilter}
        counts={counts}
        pages={pages}
        onAddRule={() => setInspector({ mode: 'create', seed: null })}
      />

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <ScrollArea className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--tf-icon-lavender)] p-2.5">
              <GitBranch className="h-4 w-4 text-[#5c2e6b]" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-lg font-semibold text-[var(--tf-dark)] dark:text-white"
                data-testid="conditions-title"
              >
                {t('title')}
              </h2>
              <p className="text-xs text-[var(--tf-muted)] dark:text-gray-400">{t('subtitle')}</p>
            </div>
          </div>

          {canEdit && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900 dark:bg-violet-950/20">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-violet-950 dark:text-violet-100">
                <Sparkles className="h-3.5 w-3.5" />
                {t('ai.title')}
              </div>
              <div className="flex gap-2">
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submitDescription();
                  }}
                  placeholder={t('ai.placeholder')}
                  data-testid="condition-ai-description"
                  className="h-9 text-xs"
                />
                <Button
                  onClick={submitDescription}
                  disabled={!description.trim()}
                  data-testid="condition-ai-submit"
                  className="shrink-0"
                >
                  {t('ai.generate')}
                </Button>
              </div>
            </div>
          )}

          {/* AI suggestions render in the rule list's own visual language, with a
              dashed border, so what you accept is what you saw. */}
          {pendingConditionSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              data-testid={`condition-suggestion-${suggestion.id}`}
              className="space-y-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-950 dark:text-violet-100">
                <Sparkles className="h-3.5 w-3.5" />
                {t('ai.suggestionTitle')}
              </p>
              <ConditionRuleCard
                rule={suggestion.rule}
                pages={pages}
                index={index}
                canEdit={false}
                showPageNumbers={pages.length > 1}
                onEdit={() => undefined}
                onDelete={() => undefined}
                onDuplicate={() => undefined}
                onToggleEnabled={() => undefined}
              />
              <p className="text-[11px] text-violet-800 dark:text-violet-300">
                {suggestion.rationale}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => {
                    if (!canEdit) return;
                    const accepted = acceptConditionSuggestion(suggestion.id);
                    if (accepted) addCondition(accepted.rule);
                  }}
                  data-testid={`condition-suggestion-accept-${suggestion.id}`}
                >
                  {t('ai.accept')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canEdit}
                  onClick={() => {
                    if (!canEdit) return;
                    dismissConditionSuggestion(suggestion.id);
                  }}
                  data-testid={`condition-suggestion-dismiss-${suggestion.id}`}
                >
                  {t('ai.dismiss')}
                </Button>
              </div>
            </div>
          ))}

          {conditions.length === 0 ? (
            <div data-testid="conditions-empty-state">
              <RecipeGallery
                pages={pages}
                canEdit={canEdit}
                onPick={(seed) => setInspector({ mode: 'create', seed })}
              />
            </div>
          ) : visibleRules.length === 0 ? (
            <div
              className="space-y-2 rounded-xl border border-dashed border-[var(--tf-border-strong)] py-14 text-center dark:border-gray-700"
              data-testid="conditions-filter-empty-state"
            >
              <GitBranch className="mx-auto h-7 w-7 text-[var(--tf-light-muted)]" />
              <h3 className="text-sm font-medium text-[var(--tf-dark)] dark:text-white">
                {t('fieldFilter.emptyTitle')}
              </h3>
              <p className="mx-auto max-w-md text-xs text-[var(--tf-muted)] dark:text-gray-400">
                {t('fieldFilter.emptyDescription')}
              </p>
              {hasActiveFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                    setActionTypeFilter(null);
                    setPageFilter(null);
                  }}
                  data-testid="logic-clear-filters"
                >
                  {t('rail.clearFilters')}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Bulk toggle acts on exactly what's on screen, and says so — the
                  count is what makes it safe to use from a filtered view. */}
              {canEdit && visibleRules.length > 1 && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-[var(--tf-muted)]"
                    onClick={toggleAllVisible}
                    data-testid="logic-bulk-toggle"
                  >
                    {t(allVisibleEnabled ? 'rail.turnAllOff' : 'rail.turnAllOn', {
                      values: { count: visibleRules.length },
                    })}
                  </Button>
                </div>
              )}
              <div className="space-y-2" role="list" aria-label={t('title')}>
                {visibleRules.map((rule) => (
                  <ConditionRuleCard
                    key={rule.id}
                    rule={rule}
                    pages={pages}
                    index={index}
                    canEdit={canEdit}
                    isCircular={health.circularRuleIds.has(rule.id)}
                    isSelected={inspector.mode === 'edit' && inspector.rule.id === rule.id}
                    showPageNumbers={pages.length > 1}
                    onEdit={() => setInspector({ mode: 'edit', rule })}
                    onDelete={() => setPendingDelete(rule)}
                    onDuplicate={() => handleDuplicate(rule)}
                    onToggleEnabled={(enabled) => setConditionEnabled(rule.id, enabled)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Inspector ───────────────────────────────────────────────────── */}
      <div
        className="relative flex shrink-0 flex-col bg-white dark:bg-card"
        style={{ borderLeft: '1px solid var(--tf-border)', width: `${inspectorWidth}px` }}
        data-testid="logic-inspector"
      >
        <div
          className={cn(
            'absolute bottom-0 left-0 top-0 w-1 cursor-col-resize hover:bg-[rgba(60,50,62,0.20)]',
            isResizing && 'bg-[rgba(60,50,62,0.40)]'
          )}
          onMouseDown={handleResizeStart}
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <GripHorizontal className="h-4 w-4 rotate-90 text-muted-foreground" />
          </div>
        </div>

        {inspector.mode === 'closed' ? (
          <ScrollArea className="min-h-0 flex-1">
            <LogicHealthPanel
              health={health}
              index={index}
              rules={conditions}
              canEdit={canEdit}
              onSelectRule={selectRuleById}
              onCleanupRule={handleCleanupRule}
            />
            <LogicSimulator pages={pages} conditions={conditions} index={index} />
          </ScrollArea>
        ) : (
          <RuleInspector
            // Remount on target change so the draft state re-seeds cleanly.
            key={inspector.mode === 'edit' ? inspector.rule.id : 'new-rule'}
            pages={pages}
            initialRule={inspector.mode === 'edit' ? inspector.rule : null}
            seed={inspector.mode === 'create' ? inspector.seed : null}
            canEdit={canEdit}
            onSave={handleSave}
            onClose={() => setInspector({ mode: 'closed' })}
          />
        )}
      </div>

      <ConfirmationDialog
        isOpen={pendingDelete !== null}
        title={t('deleteDialog.title')}
        message={
          pendingDelete ? buildRuleSentence(pendingDelete, index, t) : t('deleteDialog.message')
        }
        confirmLabel={t('card.delete')}
        variant="destructive"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
