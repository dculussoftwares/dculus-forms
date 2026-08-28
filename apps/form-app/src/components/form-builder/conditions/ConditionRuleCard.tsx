import React, { useMemo } from 'react';
import { AlertTriangle, Copy, Pencil, Trash2 } from 'lucide-react';
import { Badge, Button, Switch } from '@dculus/ui';
import { ConditionalRule, FormPage } from '@dculus/types';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { checkBackwardReference, checkRuleReferences } from './conditionFieldConfig';
import { FieldRefChip, PageRefChip, ValueChip } from './RefChips';
import {
  ACTION_TONE,
  LogicIndex,
  actionToneClass,
  resolveFieldRef,
  resolvePageRef,
} from './logicVisuals';
import { buildRuleSentence } from './ruleSentence';

interface ConditionRuleCardProps {
  rule: ConditionalRule;
  pages: FormPage[];
  index: LogicIndex;
  canEdit: boolean;
  isCircular?: boolean;
  isSelected?: boolean;
  /** Suppresses per-chip page numbers on single-page forms, where they're noise. */
  showPageNumbers?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}

/**
 * A rule rendered as a two-part statement rather than a paragraph.
 *
 * The old card printed "IF <field> <operator> "<value>" THEN <action> <fields>" as
 * one uninterrupted text run in a single weight, so the trigger half and the effect
 * half were indistinguishable and every action type looked the same. Here IF and
 * THEN are separate banded rows, references are chips carrying their field-type
 * icon and page number, and the action verb is toned by what it does — additive
 * (show/require) green, subtractive (hide/unrequire) amber, navigational (skip)
 * violet.
 */
export const ConditionRuleCard: React.FC<ConditionRuleCardProps> = ({
  rule,
  pages,
  index,
  canEdit,
  isCircular,
  isSelected,
  showPageNumbers = true,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleEnabled,
}) => {
  const { t } = useTranslation('conditions');

  const references = useMemo(() => checkRuleReferences(rule, pages), [rule, pages]);
  const backwardReference = useMemo(() => checkBackwardReference(rule, pages), [rule, pages]);
  const sentence = useMemo(() => buildRuleSentence(rule, index, t), [rule, index, t]);

  const combinatorLabel = t(`sentence.${rule.combinator === 'any' ? 'or' : 'and'}`);

  return (
    <div
      data-testid={`condition-card-${rule.id}`}
      role="listitem"
      aria-label={sentence}
      onClick={canEdit ? onEdit : undefined}
      className={cn(
        'group rounded-xl border bg-white transition-colors dark:bg-card',
        canEdit && 'cursor-pointer',
        isSelected
          ? 'border-[var(--tf-dark)] ring-1 ring-[var(--tf-dark)] dark:border-gray-300 dark:ring-gray-300'
          : 'border-[var(--tf-border-medium)] hover:border-[var(--tf-border-strong)] dark:border-gray-700 dark:hover:border-gray-600',
        !rule.enabled && 'opacity-55'
      )}
    >
      {/* ── IF ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-1 w-11 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-light-muted)] dark:text-gray-500">
          {t('card.if')}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1.5">
          {rule.terms.map((term, termIndex) => {
            const reference = resolveFieldRef(index, term.fieldId, t('card.deletedField'));
            const hasValue =
              term.value !== undefined && term.value !== null && term.value !== '';
            return (
              <React.Fragment key={termIndex}>
                {termIndex > 0 && (
                  <span className="rounded-md border border-[var(--tf-border-medium)] bg-[var(--tf-faint)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--tf-muted)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    {combinatorLabel}
                  </span>
                )}
                <FieldRefChip reference={reference} showPage={showPageNumbers} />
                <span className="text-sm text-[var(--tf-muted)] dark:text-gray-400">
                  {t(`operators.${term.operator}`)}
                </span>
                {hasValue && (
                  <ValueChip
                    value={Array.isArray(term.value) ? term.value.join(', ') : String(term.value)}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Controls stay in the header row so they're reachable without hovering
            the whole card, and the Switch keeps working for VIEWERs' read-only view. */}
        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={rule.enabled}
            disabled={!canEdit}
            onCheckedChange={onToggleEnabled}
            aria-label={t(rule.enabled ? 'card.disableRule' : 'card.enableRule', {
              values: { rule: sentence },
            })}
            data-testid={`condition-toggle-${rule.id}`}
          />
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--tf-light-muted)] opacity-70 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                onClick={onDuplicate}
                aria-label={t('card.duplicate')}
                title={t('card.duplicate')}
                data-testid={`condition-duplicate-${rule.id}`}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--tf-light-muted)] opacity-70 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                onClick={onEdit}
                aria-label={t('card.edit')}
                title={t('card.edit')}
                data-testid={`condition-edit-${rule.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive opacity-70 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                onClick={onDelete}
                aria-label={t('card.delete')}
                title={t('card.delete')}
                data-testid={`condition-delete-${rule.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── THEN ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 px-4 py-3"
        style={{ borderTop: '1px solid var(--tf-border-faint)' }}
      >
        <span className="mt-1 w-11 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-light-muted)] dark:text-gray-500">
          {t('card.then')}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1.5">
          {rule.actions.map((action, actionIndex) => (
            <React.Fragment key={actionIndex}>
              <span
                className={cn(
                  'inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold',
                  actionToneClass(ACTION_TONE[action.type])
                )}
              >
                {t(`actions.${action.type}`)}
              </span>
              {'fieldIds' in action
                ? action.fieldIds.map((fieldId) => (
                    <FieldRefChip
                      key={fieldId}
                      reference={resolveFieldRef(index, fieldId, t('card.deletedField'))}
                      showPage={showPageNumbers}
                    />
                  ))
                : (
                    <PageRefChip
                      reference={resolvePageRef(index, action.pageId, t('card.deletedPage'), (n) =>
                        t('editor.page', { values: { number: n } })
                      )}
                    />
                  )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Warnings ─────────────────────────────────────────────────────── */}
      {(references.hasBrokenReferences || isCircular || backwardReference.hasBackwardReference) && (
        <div
          className="flex flex-wrap gap-1.5 px-4 py-2.5"
          style={{ borderTop: '1px solid var(--tf-border-faint)' }}
        >
          {references.hasBrokenReferences && (
            <Badge
              variant="destructive"
              className="gap-1 text-[11px]"
              title={t('card.brokenReferenceHint')}
              data-testid={`condition-broken-${rule.id}`}
            >
              <AlertTriangle className="h-3 w-3" />
              {t('card.brokenReference')}
            </Badge>
          )}
          {isCircular && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-200 bg-amber-50 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
              title={t('card.circularHint')}
              data-testid={`condition-circular-${rule.id}`}
            >
              <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              {t('card.circular')}
            </Badge>
          )}
          {backwardReference.hasBackwardReference && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-200 bg-amber-50 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
              title={t('card.backwardReferenceHint')}
              data-testid={`condition-backward-${rule.id}`}
            >
              <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              {t('card.backwardReference')}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
