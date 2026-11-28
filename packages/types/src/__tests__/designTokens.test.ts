import { describe, expect, it } from 'vitest';
import { formLayoutValidationSchema, sanitizeDesignTokens } from '../index';

describe('sanitizeDesignTokens', () => {
  it('keeps a fully valid token set', () => {
    const tokens = {
      version: 1,
      primaryColor: '#2563eb',
      surfaceColor: '#fafafa',
      headingFont: 'lora',
      bodyFont: 'inter',
      radius: 'lg',
      inputStyle: 'filled',
      buttonStyle: 'soft',
    };
    expect(sanitizeDesignTokens(tokens)).toEqual(tokens);
  });

  it('drops invalid keys individually and keeps the valid ones', () => {
    expect(
      sanitizeDesignTokens({
        version: 1,
        primaryColor: 'blue',
        radius: 'pill',
        headingFont: 'comic-sans',
        buttonStyle: 'outline',
        unknown: 'x',
      })
    ).toEqual({ version: 1, radius: 'pill', buttonStyle: 'outline' });
  });

  it('tolerates a missing version', () => {
    expect(sanitizeDesignTokens({ primaryColor: '#112233' })).toEqual({
      version: 1,
      primaryColor: '#112233',
    });
  });

  it.each([undefined, null, 'x', 42, [], {}, { version: 1 }, { primaryColor: 'nope' }])(
    'returns undefined for unusable input %p',
    (input) => {
      expect(sanitizeDesignTokens(input)).toBeUndefined();
    }
  );

  it('is accepted by the layout schema as an optional key', () => {
    const base = {
      theme: 'light',
      textColor: '#000000',
      spacing: 'normal',
      code: 'L1',
      content: '',
      thankYouContent: '',
      customBackGroundColor: '#ffffff',
      backgroundImageKey: '',
      pageMode: 'multipage',
    };
    expect(formLayoutValidationSchema.safeParse(base).success).toBe(true);
    expect(
      formLayoutValidationSchema.safeParse({ ...base, tokens: { version: 1, radius: 'sm' } }).success
    ).toBe(true);
    expect(
      formLayoutValidationSchema.safeParse({ ...base, tokens: { version: 1, radius: 'huge' } }).success
    ).toBe(false);
  });
});
