import React from 'react';
import { AlertTriangle, FileStack } from 'lucide-react';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { FieldRef, PageRef, fieldVisual } from './logicVisuals';

/**
 * Chips that render a rule's field/page references.
 *
 * Before the redesign, a rule read as a run of plain text — "Multi-Line Text Area
 * contains …" gave no indication of the field's type or which page it lived on,
 * and a deleted field was indistinguishable from a live one except for a separate
 * badge at the bottom of the card. These chips carry the same pastel field-type
 * tile the journey rail uses (so a field looks the same in Content and Logic),
 * plus its page number, and render a dangling reference in place as struck-through
 * red rather than as a footnote.
 */

interface FieldRefChipProps {
  reference: FieldRef;
  /** Renders the page number suffix. Suppressed on single-page forms. */
  showPage?: boolean;
  onClick?: () => void;
  className?: string;
}

export const FieldRefChip: React.FC<FieldRefChipProps> = ({
  reference,
  showPage = true,
  onClick,
  className,
}) => {
  const { t } = useTranslation('conditions');
  const { Icon, tileClass, typeLabel } = fieldVisual(reference.field);

  const body = (
    <>
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
          reference.missing
            ? 'bg-[var(--tf-error-bg-md)] text-[var(--tf-error)] dark:bg-red-950/50 dark:text-red-300'
            : tileClass
        )}
      >
        {reference.missing ? <AlertTriangle className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
      </span>
      <span className={cn('min-w-0 truncate', reference.missing && 'line-through')}>
        {reference.label}
      </span>
      {showPage && reference.pageNumber !== null && (
        <span className="shrink-0 text-[11px] font-normal text-[var(--tf-light-muted)] dark:text-gray-500">
          {t('chip.pageShort', { values: { number: reference.pageNumber } })}
        </span>
      )}
    </>
  );

  const classes = cn(
    'inline-flex max-w-[18rem] items-center gap-1.5 rounded-md border px-2 py-1 align-middle text-sm font-medium',
    reference.missing
      ? 'border-[var(--tf-error-bg-lg)] bg-[var(--tf-error-bg)] text-[var(--tf-error)] dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
      : 'border-[var(--tf-border-medium)] bg-white text-[var(--tf-dark)] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100',
    onClick && 'cursor-pointer hover:border-[var(--tf-border-strong)] hover:bg-[var(--tf-faint)] dark:hover:bg-gray-800',
    className
  );

  const title = reference.missing
    ? t('chip.missingFieldHint')
    : `${reference.label} · ${typeLabel}`;

  if (!onClick) {
    return (
      <span className={classes} title={title}>
        {body}
      </span>
    );
  }
  return (
    <button type="button" className={classes} title={title} onClick={onClick}>
      {body}
    </button>
  );
};

interface PageRefChipProps {
  reference: PageRef;
  className?: string;
}

export const PageRefChip: React.FC<PageRefChipProps> = ({ reference, className }) => {
  const { t } = useTranslation('conditions');
  return (
    <span
      className={cn(
        'inline-flex max-w-[18rem] items-center gap-1.5 rounded-md border px-2 py-1 align-middle text-sm font-medium',
        reference.missing
          ? 'border-[var(--tf-error-bg-lg)] bg-[var(--tf-error-bg)] text-[var(--tf-error)] dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
          : 'border-[var(--tf-border-medium)] bg-white text-[var(--tf-dark)] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100',
        className
      )}
      title={reference.missing ? t('chip.missingPageHint') : reference.label}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
          reference.missing
            ? 'bg-[var(--tf-error-bg-md)] text-[var(--tf-error)] dark:bg-red-950/50 dark:text-red-300'
            : 'bg-[var(--tf-icon-teal)] text-[var(--tf-green)]'
        )}
      >
        {reference.missing ? <AlertTriangle className="h-3 w-3" /> : <FileStack className="h-3 w-3" />}
      </span>
      <span className={cn('min-w-0 truncate', reference.missing && 'line-through')}>
        {reference.label}
      </span>
    </span>
  );
};

/** The literal a term compares against, styled to read as data rather than prose. */
export const ValueChip: React.FC<{ value: string }> = ({ value }) => (
  <span className="inline-flex max-w-[16rem] items-center rounded-md border border-[var(--tf-border-medium)] bg-[var(--tf-faint)] px-2 py-1 align-middle font-mono text-xs text-[var(--tf-dark)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
    <span className="min-w-0 truncate">{value}</span>
  </span>
);
