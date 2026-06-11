import { useId } from 'react';

interface GradientSparklesProps {
  size?: number;
  className?: string;
}

export function GradientSparkles({ size = 16, className }: GradientSparklesProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `sg-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"
        fill={`url(#${gradId})`}
        stroke="none"
      />
      <path d="M5 3v4" stroke={`url(#${gradId})`} />
      <path d="M19 17v4" stroke={`url(#${gradId})`} />
      <path d="M3 5h4" stroke={`url(#${gradId})`} />
      <path d="M17 19h4" stroke={`url(#${gradId})`} />
    </svg>
  );
}
