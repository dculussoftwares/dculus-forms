import React from 'react';
import { cn } from '@dculus/utils';

interface FilterChipProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'primary';
  className?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  children,
  selected = false,
  onClick,
  variant = 'default',
  className,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        // Base styles - Material-UI inspired
        'inline-flex items-center justify-center',
        'px-3 py-1',
        'rounded-full',
        'text-xs font-medium',
        'transition-all duration-200 ease-in-out',
        'border',
        'cursor-pointer',
        'select-none',
        'whitespace-nowrap',
        'min-h-[24px]',

        // Hover and active effects
        'hover:shadow-md active:scale-95',

        // Focus styles
        'focus:outline-none focus:ring-2 focus:ring-offset-2',

        // Default variant styles
        variant === 'default' && [
          // Unselected state
          !selected && [
            'bg-white hover:bg-gray-50',
            'border-gray-200 hover:border-gray-300',
            'text-gray-600 hover:text-gray-800',
            'focus:ring-gray-500',
            'shadow-sm',
          ],
          // Selected state
          selected && [
            'bg-gray-900 hover:bg-gray-800',
            'border-none',
            'text-white',
            'shadow-sm',
            'focus:ring-gray-500',
          ],
        ],

        // Primary variant styles
        variant === 'primary' && [
          // Unselected state
          !selected && [
            'bg-white hover:bg-gray-50',
            'border-gray-200 hover:border-gray-300',
            'text-gray-600 hover:text-gray-800',
            'focus:ring-gray-500',
            'shadow-sm',
          ],
          // Selected state
          selected && [
            'bg-gray-900 hover:bg-gray-800',
            'border-none',
            'text-white',
            'shadow-sm',
            'focus:ring-gray-500',
          ],
        ],

        className
      )}
    >
      <span className="flex items-center gap-1">
        {children}
      </span>
    </button>
  );
};

// Optional: Export as default
export default FilterChip;