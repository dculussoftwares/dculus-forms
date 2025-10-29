import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@dculus/utils';
import { Button } from './button';

interface ChipProps {
  children: React.ReactNode;
  variant?: 'default' | 'filter' | 'outline';
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  icon?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Chip Component
 *
 * A versatile chip/tag component that supports multiple variants:
 * - `default`: Selectable chip with toggle states (e.g., category filters)
 * - `filter`: Displayed filter with icon and remove button (e.g., active filters)
 * - `outline`: Outlined style for subtle emphasis
 *
 * @example
 * // Category selection chip
 * <Chip selected={isActive} onClick={() => setActive(!isActive)}>
 *   All Forms
 * </Chip>
 *
 * @example
 * // Filter chip with icon and remove button
 * <Chip variant="filter" icon={<FileIcon />} onRemove={() => removeFilter()}>
 *   Status: Published
 * </Chip>
 */
export const Chip = React.forwardRef<HTMLButtonElement | HTMLDivElement, ChipProps>(
  ({
    children,
    variant = 'default',
    selected = false,
    onClick,
    onRemove,
    icon,
    className,
    size = 'md',
  }, ref) => {
    // Size classes
    const sizeClasses = {
      sm: 'px-2 py-0.5 text-xs min-h-[20px]',
      md: 'px-3 py-1 text-sm min-h-[24px]',
      lg: 'px-4 py-2 text-base min-h-[32px]',
    };

    // Filter variant - non-interactive display with optional remove button
    if (variant === 'filter') {
      return (
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          className={cn(
            'inline-flex items-center gap-1.5',
            sizeClasses[size],
            'bg-blue-50/80 border border-blue-200/60 rounded-full',
            'hover:bg-blue-100/80 transition-colors',
            className
          )}
        >
          {icon && (
            <div className="text-blue-700 flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="text-blue-800 font-medium truncate max-w-xs">
            {children}
          </div>
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              className="h-6 w-6 p-0 hover:bg-blue-200/50 text-blue-700 hover:text-blue-900 ml-1 flex-shrink-0 rounded-full"
              aria-label="Remove filter"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove</span>
            </Button>
          )}
        </div>
      );
    }

    // Interactive chip variants (default and outline)
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        onClick={onClick}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center',
          sizeClasses[size],
          'rounded-full font-medium',
          'transition-all duration-200 ease-in-out',
          'border cursor-pointer select-none whitespace-nowrap',

          // Hover and active effects
          'hover:shadow-md active:scale-95',

          // Focus styles for accessibility
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500',

          // Default variant
          variant === 'default' && [
            !selected && [
              'bg-white hover:bg-gray-50',
              'border-gray-200 hover:border-gray-300',
              'text-gray-600 hover:text-gray-800',
              'shadow-sm',
            ],
            selected && [
              'bg-gray-900 hover:bg-gray-800',
              'border-transparent',
              'text-white',
              'shadow-sm',
            ],
          ],

          // Outline variant
          variant === 'outline' && [
            !selected && [
              'bg-transparent hover:bg-gray-50',
              'border-gray-300 hover:border-gray-400',
              'text-gray-700 hover:text-gray-900',
            ],
            selected && [
              'bg-gray-100 hover:bg-gray-200',
              'border-gray-400',
              'text-gray-900',
            ],
          ],

          className
        )}
        aria-pressed={selected}
      >
        <span className="flex items-center gap-1.5">
          {icon}
          {children}
        </span>
      </button>
    );
  }
);

Chip.displayName = 'Chip';

export default Chip;
