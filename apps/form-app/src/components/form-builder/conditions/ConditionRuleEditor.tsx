import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Button,
  Checkbox,
  DatePicker,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { generateId, parseCalendarDate, formatCalendarDate } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  TRIGGER_OPERATORS,
  getTriggerFieldOptions,
  getTargetFieldOptions,
  getValueInputKind,
} from './conditionFieldConfig';

type EditorActionType = 'showField' | 'hideField' | 'hidePage' | 'skipToPage' | 'requireField' | 'unrequireField';

interface EditorAction {
  type: EditorActionType;
  fieldIds: string[];
  pageId: string;
}

interface ConditionRuleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: FormPage[];
  /** null = create a new rule */
  initialRule: ConditionalRule | null;
  onSave: (rule: ConditionalRule) => void;
}

const emptyTerm = (): ConditionTerm => ({ fieldId: '', operator: 'equals' });
const emptyAction = (): EditorAction => ({ type: 'showField', fieldIds: [], pageId: '' });

// Actions this editor can't edit (showPage from newer clients)
// are preserved verbatim on save rather than silently dropped
const preservedActions = (rule: ConditionalRule | null): ConditionAction[] =>
  (rule?.actions ?? []).filter(
    (action) =>
      !('fieldIds' in action) &&
      action.type !== 'hidePage' &&
      action.type !== 'skipToPage'
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
  // editable rows instead of an unsatisfiable empty placeholder
  if (actions.length === 0 && preservedActions(rule).length > 0) return [];
  return actions.length > 0 ? actions : [emptyAction()];
};

export const ConditionRuleEditor: React.FC<ConditionRuleEditorProps> = ({
  open,
  onOpenChange,
  pages,
  initialRule,
  onSave,
}) => {
  const { t } = useTranslation('conditions');
  const [terms, setTerms] = useState<ConditionTerm[]>([emptyTerm()]);
  const [actions, setActions] = useState<EditorAction[]>([emptyAction()]);
  const [combinator, setCombinator] = useState<'any' | 'all'>('all');

  // Re-seed the draft whenever the dialog opens for a different rule
  useEffect(() => {
    if (!open) return;
    setTerms(initialRule ? initialRule.terms.map((term) => ({ ...term })) : [emptyTerm()]);
    setActions(toEditorActions(initialRule));
    setCombinator(initialRule?.combinator ?? 'all');
  }, [open, initialRule]);

  const triggerOptions = useMemo(() => getTriggerFieldOptions(pages), [pages]);
  const targetOptions = useMemo(() => getTargetFieldOptions(pages), [pages]);

  const fieldById = useMemo(() => {
    const map = new Map(triggerOptions.map((option) => [option.field.id, option.field]));
    return map;
  }, [triggerOptions]);

  const pageLabel = (page: FormPage, index: number) =>
    page.title
      ? t('editor.pageWithTitle', { values: { number: index + 1, title: page.title } })
      : t('editor.page', { values: { number: index + 1 } });

  const updateTerm = (index: number, updates: Partial<ConditionTerm>) => {
    setTerms((current) =>
      current.map((term, i) => (i === index ? { ...term, ...updates } : term))
    );
  };

  const updateAction = (index: number, updates: Partial<EditorAction>) => {
    setActions((current) =>
      current.map((action, i) => (i === index ? { ...action, ...updates } : action))
    );
  };

  const termValid = (term: ConditionTerm): boolean => {
    const field = fieldById.get(term.fieldId);
    if (!field) return false;
    if (!(TRIGGER_OPERATORS[field.type] ?? []).includes(term.operator)) return false;
    const kind = getValueInputKind(field.type, term.operator);
    if (kind === 'none') return true;
    if (kind === 'number') return typeof term.value === 'number' && Number.isFinite(term.value);
    return typeof term.value === 'string' && term.value.trim() !== '';
  };

  const actionValid = (action: EditorAction): boolean =>
    action.type === 'hidePage' || action.type === 'skipToPage'
      ? action.pageId !== ''
      : action.fieldIds.length > 0;

  const preserved = useMemo(() => preservedActions(initialRule), [initialRule]);

  const canSave =
    terms.length > 0 &&
    terms.every(termValid) &&
    actions.length + preserved.length > 0 &&
    actions.every(actionValid);

  const handleSave = () => {
    const savedActions: ConditionAction[] = actions.map((action) =>
      action.type === 'hidePage' || action.type === 'skipToPage'
        ? { type: action.type, pageId: action.pageId }
        : { type: action.type, fieldIds: action.fieldIds }
    );
    onSave({
      id: initialRule?.id ?? generateId(),
      enabled: initialRule?.enabled ?? true,
      combinator,
      terms: terms.map((term) => ({ ...term })),
      actions: [...savedActions, ...preserved],
    });
    onOpenChange(false);
  };

  const renderValueInput = (term: ConditionTerm, index: number) => {
    const field = fieldById.get(term.fieldId);
    if (!field) return null;
    const kind = getValueInputKind(field.type, term.operator);

    switch (kind) {
      case 'none':
        return null;
      case 'number':
        return (
          <Input
            type="number"
            className="w-40"
            placeholder={t('editor.numberPlaceholder')}
            value={typeof term.value === 'number' ? term.value : ''}
            onChange={(e) =>
              updateTerm(index, {
                value: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
            data-testid={`condition-term-value-${index}`}
          />
        );
      case 'date':
        return (
          <DatePicker
            date={
              typeof term.value === 'string' && term.value
                ? parseCalendarDate(term.value)
                : undefined
            }
            onDateChange={(date?: Date) =>
              updateTerm(index, { value: date ? formatCalendarDate(date) : undefined })
            }
            placeholder={t('editor.pickDate')}
          />
        );
      case 'option': {
        const options = (field as { options?: string[] }).options ?? [];
        return (
          <Select
            value={typeof term.value === 'string' ? term.value : ''}
            onValueChange={(value) => updateTerm(index, { value })}
          >
            <SelectTrigger className="w-44" data-testid={`condition-term-value-${index}`}>
              <SelectValue placeholder={t('editor.selectOption')} />
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
      default:
        return (
          <Input
            className="w-44"
            placeholder={t('editor.valuePlaceholder')}
            value={typeof term.value === 'string' ? term.value : ''}
            onChange={(e) => updateTerm(index, { value: e.target.value })}
            data-testid={`condition-term-value-${index}`}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialRule ? t('editor.editTitle') : t('editor.createTitle')}
          </DialogTitle>
        </DialogHeader>

        {/* IF section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">{t('editor.ifSection')}</Label>
            {terms.length > 1 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">
                  {t('editor.combinatorLabel')}
                </Label>
                <Select
                  value={combinator}
                  onValueChange={(value) => setCombinator(value as 'any' | 'all')}
                >
                  <SelectTrigger className="w-40 h-8" data-testid="condition-combinator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('editor.combinatorAll')}</SelectItem>
                    <SelectItem value="any">{t('editor.combinatorAny')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {terms.map((term, index) => {
            const field = fieldById.get(term.fieldId);
            const operators = field ? (TRIGGER_OPERATORS[field.type] ?? []) : [];
            return (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Select
                  value={term.fieldId}
                  onValueChange={(fieldId) => {
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
                >
                  <SelectTrigger className="w-52" data-testid={`condition-term-field-${index}`}>
                    <SelectValue placeholder={t('editor.selectField')} />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerOptions.map(({ field: option, page, pageIndex }) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label || option.id}
                        {pages.length > 1 ? ` (${pageLabel(page, pageIndex)})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {field && (
                  <Select
                    value={term.operator}
                    onValueChange={(operator) => {
                      const kind = getValueInputKind(field.type, operator as ConditionOperator);
                      updateTerm(index, {
                        operator: operator as ConditionOperator,
                        ...(kind === 'none' ? { value: undefined } : {}),
                      });
                    }}
                  >
                    <SelectTrigger
                      className="w-44"
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
                )}

                {renderValueInput(term, index)}

                {terms.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => setTerms((current) => current.filter((_, i) => i !== index))}
                    aria-label={t('editor.removeTerm')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setTerms((current) => [...current, emptyTerm()])}
            data-testid="condition-add-term"
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('editor.addTerm')}
          </Button>
        </div>

        {/* THEN section */}
        <div className="space-y-3 border-t pt-4">
          <Label className="text-sm font-semibold">{t('editor.thenSection')}</Label>

          {actions.map((action, index) => (
            <div key={index} className="flex flex-wrap items-start gap-2">
              <Select
                value={action.type}
                onValueChange={(type) =>
                  updateAction(index, {
                    type: type as EditorActionType,
                    fieldIds: [],
                    pageId: '',
                  })
                }
              >
                <SelectTrigger className="w-40" data-testid={`condition-action-type-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="showField">{t('actions.showField')}</SelectItem>
                  <SelectItem value="hideField">{t('actions.hideField')}</SelectItem>
                  <SelectItem value="requireField">{t('actions.requireField')}</SelectItem>
                  <SelectItem value="unrequireField">{t('actions.unrequireField')}</SelectItem>
                  <SelectItem value="hidePage">{t('actions.hidePage')}</SelectItem>
                  <SelectItem value="skipToPage">{t('actions.skipToPage')}</SelectItem>
                </SelectContent>
              </Select>

              {action.type === 'hidePage' || action.type === 'skipToPage' ? (
                <Select
                  value={action.pageId}
                  onValueChange={(pageId) => updateAction(index, { pageId })}
                >
                  <SelectTrigger className="w-52" data-testid={`condition-action-page-${index}`}>
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
                <div className="flex-1 min-w-56 max-h-36 overflow-y-auto rounded-md border p-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t('editor.targetFields')}
                  </Label>
                  {targetOptions.map(({ field, label, page, pageIndex }) => (
                    <label
                      key={field.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={action.fieldIds.includes(field.id)}
                        onCheckedChange={(checked) =>
                          updateAction(index, {
                            fieldIds: checked
                              ? [...action.fieldIds, field.id]
                              : action.fieldIds.filter((id) => id !== field.id),
                          })
                        }
                        data-testid={`condition-action-target-${index}-${field.id}`}
                      />
                      <span className="truncate">
                        {label}
                        {pages.length > 1 && (
                          <span className="text-muted-foreground">
                            {' '}
                            ({pageLabel(page, pageIndex)})
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                  {action.fieldIds.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('editor.noTargetsSelected')}
                    </p>
                  )}
                </div>
              )}

              {actions.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => setActions((current) => current.filter((_, i) => i !== index))}
                  aria-label={t('editor.removeAction')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setActions((current) => [...current, emptyAction()])}
            data-testid="condition-add-action"
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('editor.addAction')}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('editor.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!canSave} data-testid="condition-save">
            {t('editor.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
