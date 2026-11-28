import type { FormDesignTokens } from '@dculus/types';

export type BrandPresetId = 'ocean' | 'sunset' | 'editorial' | 'forest' | 'berry' | 'violet';

export interface BrandPreset {
  id: BrandPresetId;
  tokens: Omit<FormDesignTokens, 'version'>;
}

/** One-click starting points; every field is optional so a preset can be refined afterwards. */
export const BRAND_PRESETS: BrandPreset[] = [
  {
    id: 'ocean',
    tokens: {
      primaryColor: '#2563eb',
      headingFont: 'dm-sans',
      bodyFont: 'dm-sans',
      radius: 'md',
      inputStyle: 'outlined',
      buttonStyle: 'solid',
    },
  },
  {
    id: 'sunset',
    tokens: {
      primaryColor: '#ea580c',
      surfaceColor: '#fff7ed',
      headingFont: 'poppins',
      bodyFont: 'poppins',
      radius: 'lg',
      inputStyle: 'filled',
      buttonStyle: 'solid',
    },
  },
  {
    id: 'editorial',
    tokens: {
      primaryColor: '#111827',
      surfaceColor: '#fafaf9',
      headingFont: 'playfair',
      bodyFont: 'lora',
      radius: 'none',
      inputStyle: 'underline',
      buttonStyle: 'outline',
    },
  },
  {
    id: 'forest',
    tokens: {
      primaryColor: '#0d9488',
      headingFont: 'merriweather',
      bodyFont: 'inter',
      radius: 'lg',
      inputStyle: 'outlined',
      buttonStyle: 'soft',
    },
  },
  {
    id: 'berry',
    tokens: {
      primaryColor: '#db2777',
      headingFont: 'poppins',
      bodyFont: 'roboto',
      radius: 'pill',
      inputStyle: 'filled',
      buttonStyle: 'solid',
    },
  },
  {
    id: 'violet',
    tokens: {
      primaryColor: '#7c3aed',
      headingFont: 'space-grotesk',
      bodyFont: 'dm-sans',
      radius: 'lg',
      inputStyle: 'outlined',
      buttonStyle: 'soft',
    },
  },
];

const KEYS = [
  'primaryColor',
  'surfaceColor',
  'headingFont',
  'bodyFont',
  'radius',
  'inputStyle',
  'buttonStyle',
] as const;

/** True when `tokens` holds exactly the preset's values (and nothing else). */
export function matchesPreset(tokens: FormDesignTokens | undefined, preset: BrandPreset): boolean {
  if (!tokens) return false;
  return KEYS.every((key) => (tokens[key] ?? undefined) === (preset.tokens[key] ?? undefined));
}
