import type { CSSProperties } from 'react';

export const CARD_STYLE: CSSProperties = { border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' };

export const roleBadgeStyle = (role: string): CSSProperties => {
  switch (role.toLowerCase()) {
    case 'owner': return { backgroundColor: 'var(--tf-icon-lavender)', color: '#5c2e6b' };
    case 'admin': return { backgroundColor: 'var(--tf-icon-salmon)', color: 'var(--tf-dark)' };
    default:      return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)' };
  }
};
