import { sanitizeDesignTokens } from '@dculus/types/validation';
import { contrastRatio, readableOn } from '@dculus/utils';
import {
  BRAND_PRESETS,
  BRAND_PRESET_CATEGORIES,
  FEATURED_BRAND_PRESETS,
  matchesPreset,
} from '../brandPresets';
import en from '../../../../locales/en/designDrawer.json';
import ta from '../../../../locales/ta/designDrawer.json';

describe('brand presets', () => {
  it('ships a curated gallery with a small featured quick-pick set', () => {
    expect(BRAND_PRESETS.length).toBeGreaterThanOrEqual(20);
    expect(FEATURED_BRAND_PRESETS.map((p) => p.id)).toEqual([
      'ocean',
      'sunset',
      'editorial',
      'forest',
      'berry',
      'violet',
    ]);
  });

  it('has unique ids and every preset is a distinct token set, so the active one is identifiable', () => {
    const ids = new Set(BRAND_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(BRAND_PRESETS.length);
    for (const preset of BRAND_PRESETS) {
      const matches = BRAND_PRESETS.filter((other) => matchesPreset({ version: 1, ...preset.tokens }, other));
      expect(matches.map((m) => m.id)).toEqual([preset.id]);
    }
  });

  it('only uses values the token sanitizer accepts, so applying never loses a field', () => {
    for (const preset of BRAND_PRESETS) {
      expect(sanitizeDesignTokens({ version: 1, ...preset.tokens })).toEqual({ version: 1, ...preset.tokens });
    }
  });

  it('keeps button text readable on every brand colour', () => {
    for (const preset of BRAND_PRESETS) {
      const brand = preset.tokens.primaryColor!;
      expect(contrastRatio(brand, readableOn(brand))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the brand colour distinguishable from its surface (3:1 for borders, focus rings, links)', () => {
    for (const preset of BRAND_PRESETS) {
      const { primaryColor, surfaceColor } = preset.tokens;
      expect(contrastRatio(primaryColor!, surfaceColor ?? '#ffffff')).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses a known category and has an English and Tamil name for each', () => {
    for (const preset of BRAND_PRESETS) {
      expect(BRAND_PRESET_CATEGORIES).toContain(preset.category);
      expect((en.brandStyle.presets as Record<string, string>)[preset.id]).toBeTruthy();
      expect((ta.brandStyle.presets as Record<string, string>)[preset.id]).toBeTruthy();
    }
    for (const category of BRAND_PRESET_CATEGORIES) {
      expect((en.themeGallery.categories as Record<string, string>)[category]).toBeTruthy();
      expect((ta.themeGallery.categories as Record<string, string>)[category]).toBeTruthy();
    }
  });
});
