import React from 'react';
import { ThemeType, SpacingType } from '@dculus/types';
import type { LayoutStyles } from '../../renderers/PageRenderer';

/**
 * Applies the three `FormLayout` presentation controls — `theme`, `spacing`,
 * `textColor` — that the builder has always exposed but the viewer never read.
 *
 *  - **theme**: `light` / `dark` / `auto`. Tailwind runs in `darkMode: 'class'`,
 *    so the layout root gets a `dark` class when the resolved scheme is dark;
 *    every `dark:` utility already sprinkled through the layouts then activates.
 *    `auto` follows `prefers-color-scheme` and updates live.
 *  - **spacing**: `compact` / `normal` / `spacious` — scales the form field
 *    rhythm and the screen padding.
 *  - **textColor**: a respondent-facing body text colour, applied via the
 *    `--form-fg` custom property. Honoured in light mode only; dark mode keeps
 *    its own legible palette.
 */

/** Resolve `auto` against the OS preference; re-render when it flips. */
export function useResolvedColorScheme(theme: ThemeType | undefined): 'light' | 'dark' {
  const [systemDark, setSystemDark] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Stored `theme` is inconsistently cased in the wild — some forms hold
  // `'LIGHT'`/`'DARK'`/`'AUTO'` (the builder's CreateFormWizard default), others
  // the lowercase enum values. Normalise, and treat anything unrecognised as
  // light so wiring this control can never *darken* a form the respondent's OS
  // preference wasn't asked about — matching the always-light behaviour before
  // this control was read at all.
  const normalized = String(theme ?? '').toLowerCase();
  if (normalized === 'dark') return 'dark';
  if (normalized === 'auto') return systemDark ? 'dark' : 'light';
  return 'light';
}

export interface SpacingClasses {
  /** Vertical padding for a screen's scroll pane. */
  screenPaddingY: string;
  /** Padding for the pages / thank-you content card. */
  cardPadding: string;
  /** Bottom margin between form fields (feeds `LayoutStyles.field.container`). */
  fieldGap: string;
}

const SPACING: Record<SpacingType, SpacingClasses> = {
  [SpacingType.COMPACT]: {
    screenPaddingY: 'py-2 sm:py-6',
    cardPadding: 'p-4 sm:p-6',
    fieldGap: 'mb-3',
  },
  [SpacingType.NORMAL]: {
    screenPaddingY: 'py-3 sm:py-8',
    cardPadding: 'p-4 sm:p-8',
    fieldGap: 'mb-6',
  },
  [SpacingType.SPACIOUS]: {
    screenPaddingY: 'py-4 sm:py-12',
    cardPadding: 'p-6 sm:p-10',
    fieldGap: 'mb-10',
  },
};

export function spacingClasses(spacing: SpacingType | string | undefined): SpacingClasses {
  // Tolerate the uppercase values some stored layouts use (`'NORMAL'` …).
  const key = String(spacing ?? '').toLowerCase() as SpacingType;
  return SPACING[key] ?? SPACING[SpacingType.NORMAL];
}

/** Swap the field-container bottom margin in a layout's style bundle to match `spacing`. */
export function withSpacing(
  styles: LayoutStyles,
  spacing: SpacingType | string | undefined
): LayoutStyles {
  const { fieldGap } = spacingClasses(spacing);
  const container = (styles.field.container || '')
    .replace(/\bmb-\d+\b/g, '')
    .trim();
  return {
    ...styles,
    field: {
      ...styles.field,
      container: `${container} ${fieldGap}`.trim(),
    },
  };
}

/**
 * The shared rich-text styles hard-code near-black heading/body colours with no
 * dark variant, so Lexical content renders dark-on-dark once a layout goes
 * dark. Apply this class alongside any rendered `LexicalRichTextEditor` in a
 * themable surface to pull those colours back to legible in dark mode.
 */
export const RICH_TEXT_DARK_FIX =
  'dark:[&_.editor-heading-h1]:text-white dark:[&_.editor-heading-h2]:text-gray-100 ' +
  'dark:[&_.editor-heading-h3]:text-gray-100 dark:[&_.editor-paragraph]:text-gray-300 ' +
  'dark:[&_p]:text-gray-300 dark:[&_li]:text-gray-300 dark:[&_strong]:text-inherit';

/**
 * Inline style + class for honouring `layout.textColor`. Returns an empty
 * object in dark mode (custom colours are almost always tuned for a light
 * background) or when no colour is set.
 */
export function textColorStyle(
  textColor: string | undefined,
  scheme: 'light' | 'dark'
): React.CSSProperties {
  if (!textColor || scheme === 'dark') return {};
  return { ['--form-fg' as string]: textColor, color: 'var(--form-fg)' } as React.CSSProperties;
}
