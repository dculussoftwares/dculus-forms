import { describe, expect, it } from 'vitest';
import type { LayoutStyles } from '../../renderers/PageRenderer';
import {
  buttonTokenClass,
  inputTokenClass,
  ratingTokenClass,
  resolveFormTheme,
  themedButtonClass,
  withTokens,
} from './tokens';

const styles = {
  field: { container: 'mb-4', input: 'border', textarea: 'border', select: 'border' },
  submitButton: 'bg-primary text-white rounded-full',
} as unknown as LayoutStyles;

describe('resolveFormTheme', () => {
  it('is unbranded with no tokens', () => {
    const theme = resolveFormTheme(undefined, 'light');
    expect(theme.branded).toBe(false);
    expect(theme.cssVars).toEqual({});
  });

  it('is unbranded for an empty token object', () => {
    expect(resolveFormTheme({ version: 1 }, 'light').branded).toBe(false);
  });

  it('derives primary variables', () => {
    const theme = resolveFormTheme({ version: 1, primaryColor: '#1d4ed8' }, 'light');
    expect(theme.branded).toBe(true);
    expect(theme.cssVars).toMatchObject({
      '--df-primary': '#1d4ed8',
      '--df-on-primary': '#ffffff',
    });
    expect(theme.cssVars).not.toHaveProperty('--df-radius');
  });

  it('applies the surface colour in light mode only', () => {
    const tokens = { version: 1 as const, surfaceColor: '#fafafa' };
    expect(resolveFormTheme(tokens, 'light').cssVars).toHaveProperty('--df-surface', '#fafafa');
    expect(resolveFormTheme(tokens, 'dark').branded).toBe(false);
  });

  it('sets radius and fonts', () => {
    const theme = resolveFormTheme(
      { version: 1, radius: 'pill', headingFont: 'inter', bodyFont: 'system' },
      'light'
    );
    expect(theme.cssVars).toMatchObject({ '--df-radius': '9999px' });
    expect(theme.cssVars).toHaveProperty('--df-font-heading');
    expect(theme.cssVars).toHaveProperty('--df-font-body');
  });
});

describe('withTokens', () => {
  it('returns the same reference when unbranded', () => {
    expect(withTokens(styles, resolveFormTheme(undefined, 'light'))).toBe(styles);
  });

  it('themes the submit button with the primary colour', () => {
    const theme = resolveFormTheme({ version: 1, primaryColor: '#1d4ed8' }, 'light');
    const out = withTokens(styles, theme);
    expect(out.submitButton).toContain('bg-[var(--df-primary)]');
    expect(out.submitButton).not.toMatch(/(^| )bg-primary( |$)/);
  });

  it('adds input classes for filled style and radius', () => {
    const theme = resolveFormTheme({ version: 1, inputStyle: 'filled', radius: 'md' }, 'light');
    const cls = inputTokenClass(theme);
    expect(cls).toContain('bg-[var(--df-primary-soft,#f3f4f6)]');
    expect(cls).toContain('rounded-[min(var(--df-radius),1.5rem)]');
  });

  it('drops radius on underline inputs', () => {
    const theme = resolveFormTheme({ version: 1, inputStyle: 'underline', radius: 'lg' }, 'light');
    expect(inputTokenClass(theme)).not.toContain('var(--df-radius)');
  });
});

describe('button helpers', () => {
  it('outline and soft styles differ from solid', () => {
    const t = (buttonStyle: 'solid' | 'outline' | 'soft') =>
      buttonTokenClass(resolveFormTheme({ version: 1, primaryColor: '#1d4ed8', buttonStyle }, 'light'));
    expect(t('outline')).toContain('border-2');
    expect(t('soft')).toContain('--df-primary-soft');
    expect(t('solid')).toContain('text-[color:var(--df-on-primary)]');
  });

  it('keeps the base class when unbranded', () => {
    expect(themedButtonClass('bg-primary', resolveFormTheme(undefined, 'light'))).toBe('bg-primary');
  });
});

describe('ratingTokenClass', () => {
  it('is empty without a primary colour', () => {
    expect(ratingTokenClass(resolveFormTheme(undefined, 'light'))).toBe('');
    expect(ratingTokenClass(resolveFormTheme({ version: 1, radius: 'lg' }, 'light'))).toBe('');
  });

  it('recolours the selected button with a primary colour', () => {
    const cls = ratingTokenClass(resolveFormTheme({ version: 1, primaryColor: '#1d4ed8' }, 'light'));
    expect(cls).toContain('aria-checked=true');
    expect(cls).toContain('--df-primary');
  });
});
