import type { CSSProperties } from 'react';

/**
 * Plan ids come from Chargebee and are not known at build time, so badge colors are
 * assigned from a fixed palette by a stable hash of the id (the same plan always gets
 * the same color) rather than a per-id switch. `free` is always neutral.
 */
const PALETTE: CSSProperties[] = [
  { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }, // blue
  { backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' }, // violet
  { backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }, // green
  { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }, // amber
  { backgroundColor: '#fce7f3', color: '#9d174d', border: '1px solid #fbcfe8' }, // pink
];

const NEUTRAL: CSSProperties = {
  backgroundColor: 'var(--tf-faint)',
  color: 'var(--tf-muted)',
  border: '1px solid var(--tf-border)',
};

export const planBadgeStyle = (planId: string): CSSProperties => {
  if (planId === 'free') return NEUTRAL;
  let hash = 0;
  for (const ch of planId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
};

/** "professional" -> "Professional" (fallback when the catalog name isn't to hand). */
export const planLabel = (planId: string): string =>
  planId.charAt(0).toUpperCase() + planId.slice(1).replace(/-/g, ' ');
