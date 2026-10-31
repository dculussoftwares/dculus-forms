import React from 'react';
import { cn } from '@dculus/utils';

interface LogoProps {
  /** `forms` is the Dculus Forms product mark; `brand` is the company-level Dculus mark. */
  mark?: 'forms' | 'brand';
  /** `mark` is the icon only; `full` adds the "Dculus" wordmark. */
  variant?: 'mark' | 'full';
  /** Mark size in px. */
  size?: number;
  /** Wordmark colour class; defaults to the primary (aubergine) token. */
  textClassName?: string;
  className?: string;
}

/** Dculus logos: `forms` = form card with a sprouting leaf (product); `brand` = two leaves over an input bar (company). */
export const Logo: React.FC<LogoProps> = ({
  mark = 'forms',
  variant = 'mark',
  size = 32,
  textClassName = 'text-primary',
  className,
}) => (
  <span className={cn('inline-flex items-center gap-2.5', className)}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={mark === 'forms' ? 'Dculus Forms' : 'Dculus'}
      className="shrink-0"
    >
      <rect width="64" height="64" rx="14" fill="#3c323e" />
      {mark === 'forms' ? (
        <>
          <rect x="14" y="14" width="30" height="38" rx="6" fill="#f7f7f8" />
          <rect x="20" y="21" width="12" height="3" rx="1.5" fill="#3c323e" />
          <rect x="20" y="28" width="18" height="7" rx="3.5" fill="#dedcde" />
          <rect x="20" y="38" width="18" height="7" rx="3.5" fill="#dedcde" />
          <path d="M40 25C40 15 46 9 55 9c1 10-6 16-15 16Z" fill="#36b59d" stroke="#3c323e" strokeWidth="2.5" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M31 47C15 46 13 28 21 17c14 1 19 17 10 30Z" fill="#f7f7f8" />
          <path d="M33 47c0-9 6-15 16-16 1 10-6 16-16 16Z" fill="#36b59d" />
          <rect x="19" y="50" width="26" height="4" rx="2" fill="#f7f7f8" />
        </>
      )}
    </svg>
    {variant === 'full' && (
      <span className={cn('font-semibold text-lg tracking-tight', textClassName)}>{mark === 'forms' ? 'Dculus Forms' : 'Dculus'}</span>
    )}
  </span>
);
