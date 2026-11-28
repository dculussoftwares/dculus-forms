import React from 'react';
import type { FormDesignTokens, FormRadius } from '@dculus/types';
import { cn, getFontStack, getGoogleFontsHref, hexToRgba, mixWithWhite, readableOn } from '@dculus/utils';
import type { LayoutStyles } from '../../renderers/PageRenderer';

/**
 * Design tokens (`FormLayout.tokens`) → CSS variables + class helpers.
 *
 * Contract: every token-driven style is applied ONLY when a token is set, so a
 * form without `layout.tokens` renders exactly as it did before tokens existed.
 * We never override `--primary` / `--radius` (their color format differs per app);
 * everything lives in the namespaced `--df-*` variables set on the layout wrapper.
 *
 * Tailwind only emits arbitrary classes it can read as literal strings, so every
 * `[var(--df-…)]` class below is spelled out in full — never interpolated.
 */

const RADIUS_VALUE: Record<FormRadius, string> = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.875rem',
  pill: '9999px',
};

export interface ResolvedFormTheme {
  /** True when at least one token is set. */
  branded: boolean;
  tokens: FormDesignTokens;
  /** Only the `--df-*` variables for tokens that are set. */
  cssVars: React.CSSProperties;
  /** `cssVars` plus the body font, for Radix portal content that renders outside the wrapper. */
  portalStyle: React.CSSProperties;
  /** Wrapper classes (heading font), literal Tailwind strings. */
  className: string;
  scheme: 'light' | 'dark';
  hasPrimary: boolean;
  /** `surfaceColor` is set and the scheme is light. */
  hasSurface: boolean;
}

const UNBRANDED: ResolvedFormTheme = {
  branded: false,
  tokens: { version: 1 },
  cssVars: {},
  portalStyle: {},
  className: '',
  scheme: 'light',
  hasPrimary: false,
  hasSurface: false,
};

const HEADING_FONT_CLASS =
  '[&_h1]:font-[family-name:var(--df-font-heading)] [&_h2]:font-[family-name:var(--df-font-heading)] [&_h3]:font-[family-name:var(--df-font-heading)]';

export function resolveFormTheme(
  tokens: FormDesignTokens | undefined,
  scheme: 'light' | 'dark'
): ResolvedFormTheme {
  if (!tokens) return { ...UNBRANDED, scheme };

  const vars: Record<string, string> = {};
  const hasPrimary = !!tokens.primaryColor;
  const hasSurface = !!tokens.surfaceColor && scheme === 'light';

  if (tokens.primaryColor) {
    vars['--df-primary'] = tokens.primaryColor;
    vars['--df-on-primary'] = readableOn(tokens.primaryColor);
    vars['--df-primary-soft'] =
      scheme === 'dark'
        ? hexToRgba(tokens.primaryColor, 0.2)
        : mixWithWhite(tokens.primaryColor, 0.88);
    vars['--df-ring'] = hexToRgba(tokens.primaryColor, 0.35);
  }
  if (hasSurface && tokens.surfaceColor) vars['--df-surface'] = tokens.surfaceColor;
  if (tokens.radius) vars['--df-radius'] = RADIUS_VALUE[tokens.radius];
  if (tokens.headingFont) vars['--df-font-heading'] = getFontStack(tokens.headingFont);
  if (tokens.bodyFont) vars['--df-font-body'] = getFontStack(tokens.bodyFont);

  const cssVars = vars as React.CSSProperties;
  const branded = Object.keys(vars).length > 0 || !!tokens.inputStyle || !!tokens.buttonStyle;
  if (!branded) return { ...UNBRANDED, scheme };

  const portalStyle: React.CSSProperties = tokens.bodyFont
    ? { ...cssVars, fontFamily: 'var(--df-font-body)' }
    : cssVars;

  return {
    branded,
    tokens,
    cssVars,
    portalStyle,
    className: tokens.headingFont ? HEADING_FONT_CLASS : '',
    scheme,
    hasPrimary,
    hasSurface,
  };
}

export const FormThemeContext = React.createContext<ResolvedFormTheme>(UNBRANDED);

export const useFormTheme = (): ResolvedFormTheme => React.useContext(FormThemeContext);

/** Memoized `resolveFormTheme` for components that own the token source. */
export function useResolvedFormTheme(
  tokens: FormDesignTokens | undefined,
  scheme: 'light' | 'dark'
): ResolvedFormTheme {
  return React.useMemo(() => resolveFormTheme(tokens, scheme), [tokens, scheme]);
}

/** Injects one deduped Google Fonts `<link>` for the fonts the tokens use (none for inter/system). */
export function useFormFonts(tokens?: FormDesignTokens): void {
  const href = getGoogleFontsHref([tokens?.headingFont, tokens?.bodyFont]);
  React.useEffect(() => {
    if (!href || typeof document === 'undefined') return;
    const exists = Array.from(document.head.querySelectorAll('link[data-df-fonts]')).some(
      (el) => el.getAttribute('href') === href
    );
    if (exists) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-df-fonts', '');
    document.head.appendChild(link);
  }, [href]);
}

const RADIUS_CLASS = 'rounded-[var(--df-radius)]';
// Pill caps at 1.5rem so tall controls (textareas) don't turn into capsules
const INPUT_RADIUS_CLASS = 'rounded-[min(var(--df-radius),1.5rem)]';

export type TokenControlKind = 'input' | 'textarea' | 'select';

/**
 * Classes to merge (with `cn`) after a text control's own classes. Empty when
 * unbranded. Order matters to callers: put error classes after this so the
 * semantic red border keeps winning.
 */
export function inputTokenClass(theme: ResolvedFormTheme, _kind: TokenControlKind = 'input'): string {
  if (!theme.branded) return '';
  const { radius, inputStyle } = theme.tokens;
  const classes: string[] = [];

  if (inputStyle === 'filled') {
    classes.push(
      'bg-[var(--df-primary-soft,#f3f4f6)] border-transparent dark:bg-white/10 dark:border-transparent'
    );
  } else if (inputStyle === 'underline') {
    classes.push('border-0 border-b-2 rounded-none bg-transparent px-0 shadow-none dark:bg-transparent');
  }
  if (radius && inputStyle !== 'underline') {
    classes.push(INPUT_RADIUS_CLASS);
  }
  if (theme.hasPrimary) {
    classes.push(
      'focus-visible:ring-2 focus-visible:ring-[color:var(--df-ring)] focus-visible:border-[color:var(--df-primary)] focus:border-[color:var(--df-primary)] focus-within:border-[color:var(--df-primary)]'
    );
  }
  return classes.join(' ');
}

/** Classes to merge after a call-to-action button's own classes. Empty when unbranded. */
export function buttonTokenClass(theme: ResolvedFormTheme): string {
  if (!theme.branded) return '';
  const { radius, buttonStyle = 'solid' } = theme.tokens;
  const classes: string[] = [];

  if (theme.hasPrimary) {
    if (buttonStyle === 'outline') {
      classes.push(
        'bg-transparent border-2 border-[color:var(--df-primary)] text-[color:var(--df-primary)] hover:bg-[var(--df-primary-soft)]'
      );
    } else if (buttonStyle === 'soft') {
      classes.push(
        'bg-[var(--df-primary-soft)] text-[color:var(--df-primary)] hover:bg-[var(--df-primary-soft)] hover:brightness-95'
      );
    } else {
      classes.push(
        'bg-[var(--df-primary)] text-[color:var(--df-on-primary)] hover:bg-[var(--df-primary)] hover:opacity-90'
      );
    }
    classes.push('focus-visible:ring-2 focus-visible:ring-[color:var(--df-ring)]');
  }
  if (radius) classes.push(RADIUS_CLASS);
  return classes.join(' ');
}

/** `base` with the button token classes merged over it (identity when unbranded). */
export function themedButtonClass(base: string, theme: ResolvedFormTheme): string {
  const extra = buttonTokenClass(theme);
  return extra ? cn(base, extra) : base;
}

/** Page/card background override; empty unless a surface colour is set (light scheme only). */
export function surfaceTokenClass(theme: ResolvedFormTheme): string {
  return theme.hasSurface ? 'bg-[var(--df-surface)]' : '';
}

/** `base` with the surface colour merged over its background (identity when unset). */
export function themedSurfaceClass(base: string, theme: ResolvedFormTheme): string {
  const extra = surfaceTokenClass(theme);
  return extra ? cn(base, extra) : base;
}

/** Classes for a checked checkbox, with literal strings so Tailwind emits them. */
export function checkboxTokenClass(theme: ResolvedFormTheme): string {
  if (!theme.hasPrimary) return '';
  return 'data-[state=checked]:bg-[var(--df-primary)] data-[state=checked]:border-[color:var(--df-primary)] data-[state=checked]:text-[color:var(--df-on-primary)] dark:data-[state=checked]:bg-[var(--df-primary)] dark:data-[state=checked]:border-[color:var(--df-primary)] dark:data-[state=checked]:text-[color:var(--df-on-primary)] focus-visible:ring-[color:var(--df-primary)]';
}

/** Classes for a radio item: checked border, focus ring and the inner dot. */
export function radioTokenClass(theme: ResolvedFormTheme): string {
  if (!theme.hasPrimary) return '';
  return 'text-[color:var(--df-primary)] data-[state=checked]:border-[color:var(--df-primary)] [&_svg]:fill-[color:var(--df-primary)] [&_svg]:text-[color:var(--df-primary)]';
}

/** Selected numeric-rating button; the primitive's own primary classes are overridden from the wrapper. */
export function ratingTokenClass(theme: ResolvedFormTheme): string {
  if (!theme.hasPrimary) return '';
  return '[&_button[aria-checked=true]]:!bg-[var(--df-primary)] [&_button[aria-checked=true]]:!border-[color:var(--df-primary)] [&_button[aria-checked=true]]:!text-[color:var(--df-on-primary)]';
}

/** Selected-day override for the calendar popup (the day button sets its own primary classes). */
export function calendarTokenClass(theme: ResolvedFormTheme): string {
  if (!theme.hasPrimary) return '';
  return '[&_[data-selected-single=true]]:!bg-[var(--df-primary)] [&_[data-selected-single=true]]:!text-[color:var(--df-on-primary)]';
}

/**
 * Applies tokens to a layout's style bundle. Run AFTER `withSpacing`. A no-op
 * (same reference) when unbranded.
 */
export function withTokens(styles: LayoutStyles, theme: ResolvedFormTheme): LayoutStyles {
  if (!theme.branded) return styles;
  return {
    ...styles,
    field: {
      ...styles.field,
      input: cn(styles.field.input, inputTokenClass(theme, 'input')),
      textarea: cn(styles.field.textarea, inputTokenClass(theme, 'textarea')),
      select: cn(styles.field.select, inputTokenClass(theme, 'select')),
    },
    submitButton: themedButtonClass(styles.submitButton, theme),
  };
}
