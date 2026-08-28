import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
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
import {
  ConditionAction,
  ConditionOperator,
  ConditionTerm,
  ConditionalRule,
  FormPage,
} from '@dculus/types';
import { generateId, parseCalendarDate, formatCalendarDate, cn } from '@dculus/utils';
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

type EditorActionType =
  | 'showField'
  | 'hideField'
  | 'hidePage'
  | 'skipToPage'
  | 'requireField'
  | 'unrequireField';

interface EditorAction {
  type: EditorActionType;
  fieldIds: string[];
  pageId: string;
}

const ACTION_TYPES: EditorActionType[] = [
  'showField',
  'hideField',
  'requireField',
  'unrequireField',
  'hidePage',
  'skipToPage',
];

const emptyTerm = (): ConditionTerm => ({ fieldId: '', operator: 'equals' });
const emptyAction = (): EditorAction => ({ type: 'showField', fieldIds: [], pageId: '' });

// Actions this editor can't edit (showPage from newer clients) are preserved
// verbatim on save rather than silently dropped.
const preservedActions = (rule: ConditionalRule | null): ConditionAction[] =>
  (rule?.actions ?? []).filter(
    (action) =>
      !('fieldIds' in action) && action.type !== 'hidePage' && action.type !== 'skipToPage'
  );

const toEditorActions = (rule: ConditionalRule | null): EditorAction[] => {
  if (!rule) return [emptyAction()];
  const actions: EditorAction[] = [];
  for (const action of rule.actions) {
    if ('fieldIds' in action) {
      actions.push({ type: action.type, fieldIds: [...action.fieldIds], pageId: '' });
    } else if (action.type === 'hidePage' || action.type === 'skipToPage') {
      actions.push({ type: action.type, fieldIds: [], pageId: action.pageId });
    }
  }
  // A rule holding only preserved actions must stay savable — start with no
  // editable rows instead of an unsatisfiable empty placeholder.
  if (actions.length === 0 && preservedActions(rule).length > 0) return [];
  return actions.length > 0 ? actions : [emptyAction()];
};

export interface RuleDraftSeed {
  terms?: ConditionTerm[];
  actions?: Array<Partial<EditorAction> & { type: EditorActionType }>;
  combinator?: 'any' | 'all';
}

interface RuleInspectorProps {
  pages: FormPage[];
  /** null = authoring a new rule */
  initialRule: ConditionalRule | null;
  /** Pre-fills a new rule's shape when launched from a recipe. */
  seed?: RuleDraftSeed | null;
  canEdit: boolean;
  onSave: (rule: ConditionalRule) => void;
  onClose: () => void;
}

/**
 * The rule editor, as an inline panel rather than a modal dialog.
 *
 * The dialog it replaces hid the rest of the rule list while you worked, so you
 * could not check an existing rule's wording or spot that you were duplicating
 * one. It also scrolled its own footer out of view on multi-action rules
 * (`max-h-[85vh] overflow-y-auto` on the whole dialog), and communicated an
 * incomplete row only by silently disabling Save. Here the body scrolls under a
 * fixed header and footer, each row states what it is missing, and a live
 * sentence reads the rule back to the author.
 *
 * The term/action state machine, validity rules, and the `preservedActions`
 * forward-compatibility behavior are carried over unchanged.
 */
export const RuleInspector: React.FC<RuleInspectorProps> = ({
  pages,
  initialRule,
  seed,
  canEdit,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation('conditions');
  const [terms, setTerms] = useState<ConditionTerm[]>([emptyTerm()]);
  const [actions, setActions] = useState<EditorAction[]>([emptyAction()]);
  const [combinator, setCombinator] = useState<'any' | 'all'>('all');
  const [showErrors, setShowErrors] = useState(false);

  // Re-seed the draft whenever the panel switches to a different rule.
  useEffect(() => {
    setShowErrors(false);
    if (initialRule) {
      setTerms(initialRule.terms.map((term) => ({ ...term })));
      setActions(toEditorActions(initialRule));
      setCombinator(initialRule.combinator ?? 'all');
      return;
    }
    setTerms(seed?.terms?.length ? seed.terms.map((term) => ({ ...term })) : [emptyTerm()]);
    setActions(
      seed?.actions?.length
        ? seed.actions.map((action) => ({ ...emptyAction(), ...action }))
        : [emptyAction()]
    );
    setCombinator(seed?.combinator ?? 'all');
  }, [initialRule, seed]);

  const triggerOptions = useMemo(() => getTriggerFieldOptions(pages), [pages]);
  const targetOptions = useMemo(() => getTargetFieldOptions(pages, t('chip.untitledField')), [pages, t]);
  const logicIndex = useMemo(() => buildLogicIndex(pages), [pages]);

  const fieldById = useMemo(
    () => new Map(triggerOptions.map((option) => [option.field.id, option.field])),
    [triggerOptions]
  );

  const pageLabel = (page: FormPage, index: number) =>
    page.title
      ? t('editor.pageWithTitle', { values: { number: index + 1, title: page.title } })
      : t('editor.page', { values: { number: index + 1 } });

  const updateTerm = (index: number, updates: Partial<ConditionTerm>) => {
    setTerms((current) => current.map((term, i) => (i === index ? { ...term, ...updates } : term)));
  };

  const updateAction = (index: number, updates: Partial<EditorAction>) => {
    setActions((current) =>
      current.map((action, i) => (i === index ? { ...action, ...updates } : action))
    );
  };

  /** Which requirement a term row is failing — drives the inline message. */
  const termError = (term: ConditionTerm): string | null => {
    const field = fieldById.get(term.fieldId);
    if (!field) return t('editor.errors.selectField');
    if (!(TRIGGER_OPERATORS[field.type] ?? []).includes(term.operator))
      return t('editor.errors.selectOperator');
    const kind = getValueInputKind(field.type, term.operator);
    if (kind === 'none') return null;
    if (kind === 'number')
      return typeof term.value === 'number' && Number.isFinite(term.value)
        ? null
        : t('editor.errors.enterNumber');
    return typeof term.value === 'string' && term.value.trim() !== ''
      ? null
      : t('editor.errors.enterValue');
  };

  const actionError = (action: EditorAction): string | null => {
    if (action.type === 'hidePage' || action.type === 'skipToPage') {
      return action.pageId !== '' ? null : t('editor.errors.selectPage');
    }
    return action.fieldIds.length > 0 ? null : t('editor.errors.selectTarget');
  };

  const preserved = useMemo(() => preservedActions(initialRule), [initialRule]);

  const termErrors = terms.map(termError);
  const actionErrors = actions.map(actionError);
  const canSave =
    canEdit &&
    terms.length > 0 &&
    termErrors.every((error) => error === null) &&
    actions.length + preserved.length > 0 &&
    actionErrors.every((error) => error === null);

  // Preview the draft exactly as the rule card will render it once saved.
  const draftRule: ConditionalRule = useMemo(
    () => ({
      id: initialRule?.id ?? 'draft',
      enabled: initialRule?.enabled ?? true,
      combinator,
      terms,
      actions: actions.map((action) =>
        action.type === 'hidePage' || action.type === 'skipToPage'
          ? ({ type: action.type, pageId: action.pageId } as ConditionAction)
          : ({ type: action.type, fieldIds: action.fieldIds } as ConditionAction)
      ),
    }),
    [initialRule, combinator, terms, actions]
  );
  const sentence = useMemo(
    () => buildRuleSentence(draftRule, logicIndex, t),
    [draftRule, logicIndex, t]
  );

  const handleSave = () => {
    if (!canSave) {
      setShowErrors(true);
      return;
    }
    onSave({
      id: initialRule?.id ?? generateId(),
      enabled: initialRule?.enabled ?? true,
      combinator,
      terms: terms.map((term) => ({ ...term })),
      actions: [...draftRule.actions, ...preserved],
    });
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
            onDateChange={(date?: Date) =>
              updateTerm(index, { value: date ? formatCalendarDate(date) : undefined })
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header — fixed, so Save is never scrolled away like it was in the dialog. */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-5 py-4"
        style={{ borderBottom: '1px solid var(--tf-border)' }}
      >
        <h3 className="text-base font-semibold text-[var(--tf-dark)] dark:text-gray-100">
          {initialRule ? t('editor.editTitle') : t('editor.createTitle')}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          aria-label={t('editor.cancel')}
          data-testid="condition-inspector-close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
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
                {/* The combinator sits between the rows it joins, and toggles in
                    place — it used to be a dropdown in the section header, far
                    from the rows whose relationship it described. */}
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

                <div className="space-y-2">
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
              className={cn(
                'space-y-2',
                // One hairline between consecutive actions, rather than a full
                // border around each — the panel already has an edge.
                index > 0 &&
                  'border-t border-[var(--tf-border-faint)] pt-4 dark:border-gray-800'
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

      {canEdit && (
        <div
          className="flex shrink-0 items-center justify-end gap-2 px-5 py-4"
          style={{ borderTop: '1px solid var(--tf-border)' }}
        >
          <Button variant="outline" onClick={onClose}>
            {t('editor.cancel')}
          </Button>
          {/* Deliberately never `disabled`: an incomplete rule now reports which
              row is at fault on click, instead of leaving a dead button. */}
          <Button
            onClick={handleSave}
            aria-disabled={!canSave}
            className={cn(!canSave && 'opacity-50')}
            data-testid="condition-save"
          >
            {t('editor.save')}
          </Button>
        </div>
      )}
    </div>
  );
};
