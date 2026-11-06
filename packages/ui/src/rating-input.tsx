import * as React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@dculus/utils';
import {
  normalizeRatingConfig,
  type RatingStyle,
} from '@dculus/types';

export interface RatingInputProps {
  /** Selected value; '' / undefined / null mean "no answer". */
  value?: number | '' | null;
  /** Called with the picked number, or '' when the respondent clears the answer. */
  onChange?: (value: number | '') => void;
  onBlur?: () => void;
  ratingStyle?: RatingStyle;
  minValue?: number;
  maxValue?: number;
  lowLabel?: string;
  highLabel?: string;
  /** Clicking the selected value again (or Backspace/Delete) clears it. Pass false for required fields. */
  allowClear?: boolean;
  disabled?: boolean;
  error?: boolean;
  id?: string;
  name?: string;
  /** Id of the element labelling the group (usually the field label). */
  'aria-labelledby'?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * Rating widget for the Rating field: a row of stars or a row of numbered buttons.
 *
 * Accessibility: a `radiogroup` with roving tabindex. Arrow keys move and select
 * (radio semantics), Home/End jump to the ends, Backspace/Delete/Escape clear when
 * clearing is allowed. The numbered row wraps on narrow screens instead of overflowing.
 */
export const RatingInput = React.forwardRef<HTMLDivElement, RatingInputProps>(
  (
    {
      value,
      onChange,
      onBlur,
      ratingStyle,
      minValue,
      maxValue,
      lowLabel,
      highLabel,
      allowClear = true,
      disabled = false,
      error = false,
      id,
      name,
      className,
      'aria-labelledby': ariaLabelledBy,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const config = normalizeRatingConfig({ ratingStyle, minValue, maxValue });
    const isStars = config.ratingStyle === 'stars';
    const [hovered, setHovered] = React.useState<number | null>(null);
    const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

    const options: number[] = [];
    for (let n = config.minValue; n <= config.maxValue; n += 1) options.push(n);

    const selected =
      typeof value === 'number' && options.includes(value) ? value : null;
    // The selected item is the tab stop; with no answer, the first item is.
    const tabStop = selected ?? config.minValue;
    const preview = hovered ?? selected;

    const commit = (next: number | '') => {
      if (disabled) return;
      onChange?.(next);
    };

    const focusValue = (n: number) => {
      itemRefs.current[n - config.minValue]?.focus();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, n: number) => {
      if (disabled) return;
      let target: number | null = null;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          target = Math.min(config.maxValue, n + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          target = Math.max(config.minValue, n - 1);
          break;
        case 'Home':
          target = config.minValue;
          break;
        case 'End':
          target = config.maxValue;
          break;
        case 'Backspace':
        case 'Delete':
        case 'Escape':
          if (allowClear && selected !== null) {
            event.preventDefault();
            commit('');
          }
          return;
        default:
          return;
      }
      event.preventDefault();
      commit(target);
      focusValue(target);
    };

    const handleClick = (n: number) => {
      if (n === selected && allowClear) {
        commit('');
      } else {
        commit(n);
      }
    };

    // Don't call onBlur while focus just moves between the buttons of this group.
    const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        onBlur?.();
      }
    };

    return (
      <div className={cn('space-y-1.5', className)}>
        <div
          ref={ref}
          id={id}
          role="radiogroup"
          aria-labelledby={ariaLabelledBy}
          aria-label={ariaLabelledBy ? undefined : ariaLabel ?? 'Rating'}
          aria-disabled={disabled || undefined}
          aria-invalid={error || undefined}
          data-name={name}
          onBlur={handleBlur}
          onMouseLeave={() => setHovered(null)}
          className={cn(
            'flex flex-wrap items-center',
            isStars ? 'gap-0.5' : 'gap-1.5',
            error && 'rounded-md ring-1 ring-[#ce5d55] ring-offset-2'
          )}
        >
          {options.map((n, index) => {
            const isSelected = n === selected;
            const common = {
              type: 'button' as const,
              role: 'radio' as const,
              'aria-checked': isSelected,
              tabIndex: n === tabStop ? 0 : -1,
              disabled,
              onClick: () => handleClick(n),
              onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => handleKeyDown(e, n),
              onMouseEnter: () => !disabled && setHovered(n),
              ref: (el: HTMLButtonElement | null) => {
                itemRefs.current[index] = el;
              },
            };

            if (isStars) {
              const filled = preview !== null && n <= preview;
              return (
                <button
                  key={n}
                  {...common}
                  aria-label={`${n} of ${config.maxValue} ${n === 1 ? 'star' : 'stars'}`}
                  className={cn(
                    'rounded-md p-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1',
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer active:scale-90'
                  )}
                >
                  <Star
                    aria-hidden="true"
                    className={cn(
                      'h-8 w-8 transition-colors',
                      filled
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-transparent text-gray-300 dark:text-gray-600'
                    )}
                  />
                </button>
              );
            }

            return (
              <button
                key={n}
                {...common}
                aria-label={String(n)}
                className={cn(
                  'h-10 min-w-[2.5rem] rounded-md border px-2 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
                  disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
        {(lowLabel || highLabel) && (
          <div className="flex justify-between gap-4 text-xs text-muted-foreground">
            <span className="min-w-0 break-words text-left">{lowLabel}</span>
            <span className="min-w-0 break-words text-right">{highLabel}</span>
          </div>
        )}
      </div>
    );
  }
);
RatingInput.displayName = 'RatingInput';
