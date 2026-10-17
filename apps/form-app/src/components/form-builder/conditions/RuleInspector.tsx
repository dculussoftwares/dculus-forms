import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, CloudOff, Eye, Plus, Sparkles, X } from 'lucide-react';
import {
  Button,
  DatePicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import { ConditionAction, ConditionOperator, ConditionTerm, ConditionalRule, FormPage } from '@dculus/types';
import { parseCalendarDate, formatCalendarDate, cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  TRIGGER_OPERATORS,
  getTriggerFieldOptions,
  getTargetFieldOptions,
  getValueInputKind,
} from './conditionFieldConfig';
import { FieldPicker } from './FieldPicker';
import { TargetFieldPicker } from './TargetFieldPicker';
import { ACTION_TONE, actionToneClass, buildLogicIndex } from './logicVisuals';
import { buildRuleSentence } from './ruleSentence';
import type { LogicDraftStash } from './logicDraftStorage';
import {
  ACTION_TYPES,
  cleanupDraftReferences,
  deriveSaveStatus,
  draftSignature,
  draftToRule,
  emptyAction,
  emptyTerm,
  getDraftIssues,
  initialDraftFor,
  preservedActions,
  reconcileWithLive,
  ruleSignature,
  type CommitIntent,
  type EditorAction,
  type EditorActionType,
  type RuleDraft,
  type RuleDraftSeed,
  type SaveStatus,
} from './ruleDraft';

export type { RuleDraftSeed } from './ruleDraft';

export interface RuleCommitPayload {
  intent: CommitIntent;
  ruleId: string;
  draft: RuleDraft;
  baseEnabled: boolean;
  basePreserved: ConditionAction[];
}

interface RuleInspectorProps {
  pages: FormPage[];
  mode: 'create' | 'edit';
  /** The rule id when editing, the provisional draft id when creating. */
  ruleId: string;
  /** Current store version of the rule being edited; undefined once it is deleted. */
  liveRule: ConditionalRule | undefined;
  /** Pre-fills a new rule's shape when launched from a recipe. */
  seed?: RuleDraftSeed | null;
  /** An unsaved draft recovered from an earlier visit. */
  restored?: LogicDraftStash;
  canEdit: boolean;
  isConnected: boolean;
  /** Writes the rule; the inspector stays mounted on anything but 'ok'. */
  onCommit: (payload: RuleCommitPayload) => 'ok' | 'deleted' | 'failed';
  /** Guarded close — the parent decides whether to confirm discarding. */
  onRequestClose: () => void;
  /** Close without a guard (user already chose to discard). */
  onDiscard: () => void;
  onDraftChange: (state: { stash: LogicDraftStash | null; isComplete: boolean }) => void;
}

const STATUS_STYLE: Record<SaveStatus, string> = {
  readOnly: 'text-[var(--tf-muted)] dark:text-gray-400',
  offline: 'text-amber-700 dark:text-amber-400',
  error: 'text-[var(--tf-error)] dark:text-red-400',
  deleted: 'text-amber-700 dark:text-amber-400',
  conflict: 'text-amber-700 dark:text-amber-400',
  createIdle: 'text-[var(--tf-muted)] dark:text-gray-400',
  clean: 'text-[var(--tf-muted)] dark:text-gray-400',
  invalid: 'text-amber-700 dark:text-amber-400',
  incomplete: 'text-[var(--tf-muted)] dark:text-gray-400',
  dirty: 'text-[var(--tf-muted)] dark:text-gray-400',
};

const StatusIcon: React.FC<{ status: SaveStatus }> = ({ status }) => {
  const className = 'mt-0.5 h-3.5 w-3.5 shrink-0';
  switch (status) {
    case 'readOnly':
      return <Eye className={className} aria-hidden="true" />;
    case 'offline':
      return <CloudOff className={className} aria-hidden="true" />;
    case 'error':
    case 'invalid':
    case 'deleted':
    case 'conflict':
      return <AlertCircle className={className} aria-hidden="true" />;
    case 'clean':
      return <Check className={cn(className, 'text-green-600')} aria-hidden="true" />;
    case 'dirty':
      return <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />;
    default:
      return null;
  }
};

const InspectorBanner: React.FC<{
  testId: string;
  tone: 'info' | 'warn';
  title: string;
  message?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  bannerRef?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
}> = ({ testId, tone, title, message, onDismiss, dismissLabel, bannerRef, children }) => (
  <div
    ref={bannerRef}
    tabIndex={-1}
    role="group"
    aria-label={title}
    data-testid={testId}
    className={cn(
      'space-y-1.5 rounded-lg border p-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
      tone === 'warn'
        ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
        : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200'
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="font-semibold">{title}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="shrink-0 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
    {message && <p className="leading-relaxed">{message}</p>}
    {children && <div className="flex flex-wrap gap-2 pt-0.5">{children}</div>}
  </div>
);

/**
 * The rule editor, as an inline panel rather than a modal dialog.
 *
 * Edits live in a local draft and reach the shared Y.js document only on an
 * explicit Create/Save: a rule is a compound statement, so any intermediate
 * "valid" state would otherwise go live to collaborators and respondents of a
 * published form. Unsaved work is guarded by the parent (in-tab exits) and
 * stashed by it (route changes, reload). The draft is compared against a `base`
 * snapshot, so remote edits are rebased, flagged as a conflict, or reported as
 * a deletion instead of being silently overwritten.
 */
export const RuleInspector: React.FC<RuleInspectorProps> = ({
  pages,
  mode,
  ruleId,
  liveRule,
  seed,
  restored,
  canEdit,
  isConnected,
  onCommit,
  onRequestClose,
  onDiscard,
  onDraftChange,
}) => {
  const { t } = useTranslation('conditions');

  const [startDraft] = useState<RuleDraft>(
    () => restored?.draft ?? initialDraftFor(mode === 'edit' ? (liveRule ?? null) : null, seed)
  );
  const [terms, setTerms] = useState<ConditionTerm[]>(startDraft.terms);
  const [actions, setActions] = useState<EditorAction[]>(startDraft.actions);
  const [combinator, setCombinator] = useState<'any' | 'all'>(startDraft.combinator);

  // The version the draft is measured against; dirtiness and conflicts derive from it.
  const [base, setBase] = useState(() => {
    if (restored) {
      return {
        signature: restored.baseSignature,
        enabled: restored.baseEnabled,
        preserved: restored.basePreserved,
      };
    }
    if (mode === 'edit' && liveRule) {
      return {
        signature: ruleSignature(liveRule),
        enabled: liveRule.enabled,
        preserved: preservedActions(liveRule),
      };
    }
    return { signature: draftSignature(startDraft), enabled: true, preserved: [] as ConditionAction[] };
  });

  const [showErrors, setShowErrors] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  const [restoredDismissed, setRestoredDismissed] = useState(false);
  const [focusIssueTick, setFocusIssueTick] = useState(0);
  const committingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoredBannerRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const triggerOptions = useMemo(() => getTriggerFieldOptions(pages), [pages]);
  const targetOptions = useMemo(() => getTargetFieldOptions(pages, t('chip.untitledField')), [pages, t]);
  const logicIndex = useMemo(() => buildLogicIndex(pages), [pages]);

  const fieldById = useMemo(
    () => new Map(triggerOptions.map((option) => [option.field.id, option.field])),
    [triggerOptions]
  );
  const existingFieldIds = useMemo(
    () => new Set(pages.flatMap((page) => page.fields.map((field) => field.id))),
    [pages]
  );
  const existingPageIds = useMemo(() => new Set(pages.map((page) => page.id)), [pages]);

  const draft = useMemo<RuleDraft>(
    () => ({ terms, actions, combinator }),
    [terms, actions, combinator]
  );
  const signature = useMemo(() => draftSignature(draft), [draft]);
  const isDirty = signature !== base.signature;

  const issues = useMemo(
    () =>
      getDraftIssues(draft, {
        triggerFieldById: fieldById,
        existingFieldIds,
        existingPageIds,
        preservedCount: base.preserved.length,
      }),
    [draft, fieldById, existingFieldIds, existingPageIds, base.preserved.length]
  );
  const isComplete = issues.count === 0;

  const remote = reconcileWithLive({
    mode,
    baseSignature: base.signature,
    draftSignature: signature,
    liveRule,
  });

  const hasBrokenRefs = useMemo(
    () =>
      cleanupDraftReferences(draft, {
        existingFieldIds,
        existingPageIds,
        preservedCount: base.preserved.length,
      }).removed > 0,
    [draft, existingFieldIds, existingPageIds, base.preserved.length]
  );

  const status = deriveSaveStatus({
    canEdit,
    isConnected,
    mode,
    isDirty,
    isComplete,
    showErrors,
    remote,
    writeFailed,
  });

  const applyDraft = (next: RuleDraft) => {
    setTerms(next.terms);
    setActions(next.actions);
    setCombinator(next.combinator);
  };

  const adoptLive = (rule: ConditionalRule) => {
    applyDraft(initialDraftFor(rule));
    setBase({
      signature: ruleSignature(rule),
      enabled: rule.enabled,
      preserved: preservedActions(rule),
    });
  };

  // A clean draft (or one that matches) follows collaborators' changes.
  useEffect(() => {
    if (committingRef.current || remote !== 'rebase' || !liveRule) return;
    adoptLive(liveRule);
  }, [remote, liveRule]);

  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  useEffect(() => {
    onDraftChangeRef.current({
      stash: isDirty
        ? {
            v: 1,
            mode,
            ruleId,
            baseSignature: base.signature,
            baseEnabled: base.enabled,
            basePreserved: base.preserved,
            draft: { terms, actions, combinator },
            savedAt: Date.now(),
          }
        : null,
      isComplete,
    });
  }, [isDirty, isComplete, base, mode, ruleId, terms, actions, combinator]);

  useEffect(() => {
    setWriteFailed(false);
  }, [isConnected, signature]);

  // Mount-only: an existing rule that is already invalid shows its problems
  // straight away (they aren't mid-composition), and focus lands on the first
  // row for a new rule or the heading otherwise.
  useEffect(() => {
    if (mode === 'edit' && !restored && issues.count > 0) setShowErrors(true);
    if (restored) restoredBannerRef.current?.focus();
    else if (mode === 'create') {
      rootRef.current
        ?.querySelector<HTMLElement>('[data-testid="condition-term-field-0"]')
        ?.focus();
    } else headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (focusIssueTick === 0) return;
    rootRef.current
      ?.querySelector<HTMLElement>(
        '[data-issue="true"] button, [data-issue="true"] input, [data-issue="true"] [tabindex]'
      )
      ?.focus();
  }, [focusIssueTick]);

  const updateTerm = (index: number, updates: Partial<ConditionTerm>) => {
    setTerms((current) => current.map((term, i) => (i === index ? { ...term, ...updates } : term)));
  };

  const updateAction = (index: number, updates: Partial<EditorAction>) => {
    setActions((current) =>
      current.map((action, i) => (i === index ? { ...action, ...updates } : action))
    );
  };

  const pageLabel = (page: FormPage, index: number) =>
    page.title
      ? t('editor.pageWithTitle', { values: { number: index + 1, title: page.title } })
      : t('editor.page', { values: { number: index + 1 } });

  const termErrors = issues.terms.map((issue) => (issue ? t(`editor.errors.${issue}`) : null));
  const actionErrors = issues.actions.map((issue) => (issue ? t(`editor.errors.${issue}`) : null));

  // Preview the draft exactly as the rule card will render it once saved.
  const sentence = useMemo(
    () => buildRuleSentence(draftToRule(draft, ruleId, base.enabled, []), logicIndex, t),
    [draft, ruleId, base.enabled, logicIndex, t]
  );

  const handleSave = () => {
    if (!canEdit || committingRef.current) return;
    const intent: CommitIntent =
      remote === 'deleted' ? 'recreate' : mode === 'create' ? 'create' : 'update';
    if (intent === 'update' && !isDirty) return;
    if (!isComplete) {
      setShowErrors(true);
      setFocusIssueTick((tick) => tick + 1);
      return;
    }
    if (!isConnected) return;

    committingRef.current = true;
    const result = onCommit({
      intent,
      ruleId,
      draft,
      baseEnabled: base.enabled,
      basePreserved: base.preserved,
    });
    if (result !== 'ok') {
      committingRef.current = false;
      if (result === 'failed') setWriteFailed(true);
    }
  };

  const handleRevert = () => {
    if (liveRule) adoptLive(liveRule);
    setShowErrors(false);
  };

  const handleRemoveBrokenRefs = () => {
    const cleaned = cleanupDraftReferences(draft, {
      existingFieldIds,
      existingPageIds,
      preservedCount: base.preserved.length,
    });
    applyDraft(cleaned.draft);
    setShowErrors(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Portalled dropdown content bubbles through React but isn't inside this DOM subtree.
    if (!rootRef.current?.contains(event.target as Node)) return;
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      if (event.nativeEvent.isComposing) return;
      event.preventDefault();
      handleSave();
      return;
    }
    // Dropdowns dismiss themselves on Escape and mark the event handled.
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onRequestClose();
    }
  };

  const renderValueInput = (term: ConditionTerm, index: number) => {
    const field = fieldById.get(term.fieldId);
    if (!field) return null;
    const kind = getValueInputKind(field.type, term.operator);

    switch (kind) {
      case 'none':
        return null;
      case 'number': {
        // Values are normally stored as `number`, but tolerate a numeric string
        // (e.g. an AI-authored rule) instead of showing a blank input.
        const numericValue =
          typeof term.value === 'number'
            ? term.value
            : typeof term.value === 'string' &&
                term.value.trim() !== '' &&
                Number.isFinite(Number(term.value))
              ? Number(term.value)
              : '';
        return (
          <Input
            type="number"
            className="h-10 text-sm"
            placeholder={t('editor.numberPlaceholder')}
            disabled={!canEdit}
            value={numericValue}
            onChange={(e) =>
              updateTerm(index, {
                value: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            data-testid={`condition-term-value-${index}`}
          />
        );
      }
      case 'date': {
        // Stored dates are plain 'YYYY-MM-DD' strings; guard against any other
        // shape producing an Invalid Date instead of just showing "unset".
        const isIsoDate = typeof term.value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(term.value);
        return (
          <DatePicker
            date={isIsoDate ? parseCalendarDate(term.value as string) : undefined}
            disabled={!canEdit}
            onDateChange={(date?: Date) =>
              updateTerm(index, {
                // An unparseable Date would format to garbage and be stored as
                // the term's value; treat it as clearing the field instead.
                value:
                  date && !Number.isNaN(date.getTime()) ? formatCalendarDate(date) : undefined,
              })
            }
            placeholder={t('editor.pickDate')}
          />
        );
      }
      case 'option': {
        const options = (field as { options?: string[] }).options ?? [];
        const currentValue = typeof term.value === 'string' ? term.value : '';
        const isStaleValue = currentValue !== '' && !options.includes(currentValue);
        return (
          <Select
            value={currentValue}
            disabled={!canEdit}
            onValueChange={(value) => updateTerm(index, { value })}
          >
            <SelectTrigger className="h-10 text-sm" data-testid={`condition-term-value-${index}`}>
              <SelectValue placeholder={t('editor.selectOption')} />
            </SelectTrigger>
            <SelectContent>
              {isStaleValue && (
                <SelectItem value={currentValue}>
                  {t('editor.staleOptionValue', { values: { value: currentValue } })}
                </SelectItem>
              )}
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      default:
        return (
          <Input
            className="h-10 text-sm"
            placeholder={t('editor.valuePlaceholder')}
            disabled={!canEdit}
            value={typeof term.value === 'string' ? term.value : ''}
            onChange={(e) => updateTerm(index, { value: e.target.value })}
            data-testid={`condition-term-value-${index}`}
          />
        );
    }
  };

  const rowError = (error: string | null) =>
    showErrors && error ? (
      <p className="text-xs text-[var(--tf-error)] dark:text-red-400">{error}</p>
    ) : null;
  const rowIssueAttr = (error: string | null) => (showErrors && error ? 'true' : undefined);

  const primaryLabel =
    remote === 'deleted'
      ? t('editor.recreateRule')
      : mode === 'create'
        ? t('editor.createRule')
        : t('editor.saveChanges');
  const primaryInert = !isConnected || (remote !== 'deleted' && mode === 'edit' && !isDirty);

  const showRestored = Boolean(restored) && !restoredDismissed;
  const showLostAccess = !canEdit && (isDirty || Boolean(restored));
  const showBrokenRefs = hasBrokenRefs && canEdit;
  const hasBanners =
    showRestored ||
    remote === 'conflict' ||
    remote === 'deleted' ||
    showBrokenRefs ||
    showLostAccess;

  return (
    <div
      ref={rootRef}
      role="region"
      aria-labelledby={headingId}
      className="flex h-full min-h-0 flex-col"
      onKeyDown={handleKeyDown}
    >
      {/* Header — fixed, so the controls are never scrolled away. */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-5 py-4"
        style={{ borderBottom: '1px solid var(--tf-border)' }}
      >
        <h3
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-[var(--tf-dark)] outline-none dark:text-gray-100"
        >
          {mode === 'edit' ? t('editor.editTitle') : t('editor.createTitle')}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRequestClose}
          aria-label={t('editor.close')}
          data-testid="condition-inspector-close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
        {hasBanners && (
          <div className="space-y-2">
            {showRestored && (
              <InspectorBanner
                testId="condition-restored-banner"
                tone="info"
                title={t('editor.banner.restoredTitle')}
                message={t('editor.banner.restoredMessage')}
                onDismiss={() => setRestoredDismissed(true)}
                dismissLabel={t('editor.banner.dismiss')}
                bannerRef={restoredBannerRef}
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={onDiscard}
                  data-testid="condition-restored-discard"
                >
                  {t('editor.banner.discard')}
                </Button>
              </InspectorBanner>
            )}
            {remote === 'conflict' && (
              <InspectorBanner
                testId="condition-conflict-banner"
                tone="warn"
                title={t('editor.banner.conflictTitle')}
                message={t('editor.banner.conflictMessage')}
              >
                {liveRule && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      adoptLive(liveRule);
                      setShowErrors(false);
                    }}
                    data-testid="condition-load-theirs"
                  >
                    {t('editor.banner.loadTheirs')}
                  </Button>
                )}
              </InspectorBanner>
            )}
            {remote === 'deleted' && (
              <InspectorBanner
                testId="condition-deleted-banner"
                tone="warn"
                title={t('editor.banner.deletedTitle')}
                message={t('editor.banner.deletedMessage')}
              />
            )}
            {showBrokenRefs && (
              <InspectorBanner
                testId="condition-broken-refs-banner"
                tone="warn"
                title={t('editor.banner.brokenRefs')}
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleRemoveBrokenRefs}
                  data-testid="condition-remove-broken-refs"
                >
                  {t('editor.banner.removeBrokenRefs')}
                </Button>
              </InspectorBanner>
            )}
            {showLostAccess && (
              <InspectorBanner
                testId="condition-readonly-banner"
                tone="warn"
                title={t('editor.banner.lostAccess')}
              />
            )}
          </div>
        )}

        {/* ── WHEN ───────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--tf-muted)] dark:text-gray-400">
            {t('editor.ifSection')}
          </Label>

          {terms.map((term, index) => {
            const field = fieldById.get(term.fieldId);
            const operators = field ? (TRIGGER_OPERATORS[field.type] ?? []) : [];
            return (
              <React.Fragment key={index}>
                {/* The combinator sits between the rows it joins, and toggles in place. */}
                {index > 0 && (
                  <div className="flex items-center gap-2 py-0.5">
                    <button
                      type="button"
                      disabled={!canEdit}
                      data-testid="condition-combinator"
                      onClick={() => setCombinator(combinator === 'all' ? 'any' : 'all')}
                      title={t(
                        combinator === 'all' ? 'editor.combinatorAll' : 'editor.combinatorAny'
                      )}
                      className="rounded-md border border-[var(--tf-border-medium)] bg-[var(--tf-faint)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--tf-muted)] hover:border-[var(--tf-border-strong)] disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                    >
                      {t(`sentence.${combinator === 'any' ? 'or' : 'and'}`)}
                    </button>
                    <span className="h-px flex-1 bg-[var(--tf-border-faint)] dark:bg-gray-800" />
                  </div>
                )}

                <div className="space-y-2" data-issue={rowIssueAttr(termErrors[index])}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <FieldPicker
                        options={triggerOptions}
                        value={term.fieldId}
                        pages={pages}
                        disabled={!canEdit}
                        data-testid={`condition-term-field-${index}`}
                        onChange={(fieldId) => {
                          const nextField = fieldById.get(fieldId);
                          const nextOperators = nextField
                            ? (TRIGGER_OPERATORS[nextField.type] ?? [])
                            : [];
                          updateTerm(index, {
                            fieldId,
                            operator: nextOperators[0] ?? 'equals',
                            value: undefined,
                          });
                        }}
                      />

                      {field && (
                        // Operators like isEmpty/isFilled take no value, so the
                        // value slot is omitted rather than left as an empty
                        // flex child that halves the operator's width.
                        <div className="flex gap-2">
                          <Select
                            value={term.operator}
                            disabled={!canEdit}
                            onValueChange={(operator) => {
                              const kind = getValueInputKind(
                                field.type,
                                operator as ConditionOperator
                              );
                              updateTerm(index, {
                                operator: operator as ConditionOperator,
                                ...(kind === 'none' ? { value: undefined } : {}),
                              });
                            }}
                          >
                            <SelectTrigger
                              className="h-10 flex-1 text-sm"
                              data-testid={`condition-term-operator-${index}`}
                            >
                              <SelectValue placeholder={t('editor.selectOperator')} />
                            </SelectTrigger>
                            <SelectContent>
                              {operators.map((operator) => (
                                <SelectItem key={operator} value={operator}>
                                  {t(`operators.${operator}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(() => {
                            const valueInput = renderValueInput(term, index);
                            return valueInput ? (
                              <div className="min-w-0 flex-1">{valueInput}</div>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>

                    {canEdit && terms.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground"
                        onClick={() => setTerms((current) => current.filter((_, i) => i !== index))}
                        aria-label={t('editor.removeTerm')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {rowError(termErrors[index])}
                </div>
              </React.Fragment>
            );
          })}

          {canEdit && (
            <Button
              className="h-10 w-full text-sm"
              onClick={() => setTerms((current) => [...current, emptyTerm()])}
              data-testid="condition-add-term"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t('editor.addTerm')}
            </Button>
          )}
        </section>

        {/* ── DO ─────────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--tf-muted)] dark:text-gray-400">
            {t('editor.thenSection')}
          </Label>

          {actions.map((action, index) => (
            <div
              key={index}
              data-issue={rowIssueAttr(actionErrors[index])}
              className={cn(
                'space-y-2',
                // One hairline between consecutive actions, rather than a full
                // border around each — the panel already has an edge.
                index > 0 && 'border-t border-[var(--tf-border-faint)] pt-4 dark:border-gray-800'
              )}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Select
                    value={action.type}
                    disabled={!canEdit}
                    onValueChange={(type) =>
                      updateAction(index, {
                        type: type as EditorActionType,
                        fieldIds: [],
                        pageId: '',
                      })
                    }
                  >
                    <SelectTrigger
                      className="h-10 text-sm"
                      data-testid={`condition-action-type-${index}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                'h-2 w-2 shrink-0 rounded-full border',
                                actionToneClass(ACTION_TONE[type])
                              )}
                            />
                            {t(`actions.${type}`)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {action.type === 'hidePage' || action.type === 'skipToPage' ? (
                    <Select
                      value={action.pageId}
                      disabled={!canEdit}
                      onValueChange={(pageId) => updateAction(index, { pageId })}
                    >
                      <SelectTrigger
                        className="h-10 text-sm"
                        data-testid={`condition-action-page-${index}`}
                      >
                        <SelectValue placeholder={t('editor.selectPage')} />
                      </SelectTrigger>
                      <SelectContent>
                        {pages.map((page, pageIndex) => (
                          <SelectItem key={page.id} value={page.id}>
                            {pageLabel(page, pageIndex)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <TargetFieldPicker
                      options={targetOptions}
                      selectedIds={action.fieldIds}
                      pages={pages}
                      disabled={!canEdit}
                      actionIndex={index}
                      onChange={(fieldIds) => updateAction(index, { fieldIds })}
                    />
                  )}
                </div>

                {canEdit && actions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground"
                    onClick={() => setActions((current) => current.filter((_, i) => i !== index))}
                    aria-label={t('editor.removeAction')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {rowError(actionErrors[index])}
            </div>
          ))}

          {canEdit && (
            <Button
              className="h-10 w-full text-sm"
              onClick={() => setActions((current) => [...current, emptyAction()])}
              data-testid="condition-add-action"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t('editor.addAction')}
            </Button>
          )}
        </section>

        {/* Read the rule back in one sentence, so the author can check intent
            without mentally executing the dropdowns. */}
        <section
          className="rounded-lg bg-[var(--tf-faint)] p-4 dark:bg-gray-800/60"
          data-testid="condition-rule-preview"
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--tf-muted)] dark:text-gray-400">
            <Sparkles className="h-3.5 w-3.5" />
            {t('editor.previewTitle')}
          </div>
          <p className="text-sm leading-relaxed text-[var(--tf-text)] dark:text-gray-300">
            {sentence || t('editor.previewEmpty')}
          </p>
        </section>
      </div>

      <div
        className="flex shrink-0 flex-col gap-3 px-5 py-4"
        style={{ borderTop: '1px solid var(--tf-border)' }}
      >
        <p
          className={cn('flex items-start gap-1.5 text-xs', STATUS_STYLE[status])}
          data-testid="condition-save-status"
          data-state={status}
          role="status"
          aria-live="polite"
        >
          <StatusIcon status={status} />
          <span>{t(`editor.status.${status}`)}</span>
        </p>

        {canEdit && (
          <div className="flex flex-wrap justify-end gap-2">
            {mode === 'create' ? (
              <Button variant="outline" onClick={onRequestClose} data-testid="condition-cancel">
                {t('editor.cancel')}
              </Button>
            ) : remote === 'deleted' ? (
              <Button variant="outline" onClick={onDiscard} data-testid="condition-deleted-discard">
                {t('editor.revert')}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleRevert}
                disabled={!isDirty}
                data-testid="condition-revert"
              >
                {t('editor.revert')}
              </Button>
            )}
            {/* Never `disabled`: an incomplete rule reports which row is at
                fault on click, instead of leaving a dead button. */}
            <Button
              onClick={handleSave}
              aria-disabled={primaryInert}
              title={t('editor.shortcutHint')}
              className={cn(primaryInert && 'opacity-50')}
              data-testid="condition-save"
            >
              {primaryLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
