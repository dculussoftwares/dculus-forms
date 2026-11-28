import { describe, expect, it } from 'vitest';
import { contrastRatio, readableOn, relativeLuminance } from './index';
import { FONT_CATALOG, getFontStack, getGoogleFontsHref } from './fonts';

describe('contrast helpers', () => {
  it('computes known luminance and ratios', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('picks a readable foreground', () => {
    expect(readableOn('#000000')).toBe('#ffffff');
    expect(readableOn('#ffffff')).toBe('#111111');
    expect(readableOn('#2563eb')).toBe('#ffffff');
    expect(readableOn('#fde047')).toBe('#111111');
  });
});

describe('font catalog', () => {
  it('returns stacks and falls back to system for unknown ids', () => {
    expect(getFontStack('lora')).toContain('Lora');
    expect(getFontStack('nope' as never)).toBe(FONT_CATALOG.system.stack);
  });

  it('builds one deduped Google Fonts URL and skips inter/system', () => {
    expect(getGoogleFontsHref(['inter', 'system', undefined])).toBeNull();
    const href = getGoogleFontsHref(['lora', 'lora', 'playfair', 'inter']);
    expect(href).toBe(
      'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap'
    );
  });

  it('flags Tamil-capable fonts', () => {
    expect(FONT_CATALOG['noto-sans-tamil'].supportsTamil).toBe(true);
    expect(FONT_CATALOG.roboto.supportsTamil).toBe(false);
  });
});
