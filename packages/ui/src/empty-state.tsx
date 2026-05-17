import React from 'react';
import { cn } from '@dculus/utils';

const variantStyles = {
  default: { bg: 'rgba(81,76,84,0.06)' },
  error:   { bg: 'rgba(206,93,85,0.08)' },
  warning: { bg: '#fbe19d' },
} as const;

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  variant?: keyof typeof variantStyles;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: variantStyles[variant].bg }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-semibold mb-1" style={{ color: '#3c323e' }}>{title}</h3>
      <p className="text-xs max-w-xs" style={{ color: '#655d67' }}>{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
