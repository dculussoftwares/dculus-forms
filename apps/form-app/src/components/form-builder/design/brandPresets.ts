import type { FormDesignTokens, FormRadius } from '@dculus/types';

export const RADIUS_PREVIEW: Record<FormRadius, string> = {
  none: '0px',
  sm: '3px',
  md: '6px',
  lg: '10px',
  pill: '999px',
};

export type BrandPresetCategory = 'clean' | 'soft' | 'bold' | 'elegant';

export const BRAND_PRESET_CATEGORIES: BrandPresetCategory[] = ['clean', 'soft', 'bold', 'elegant'];

export type BrandPresetId =
  | 'ocean'
  | 'sunset'
  | 'editorial'
  | 'forest'
  | 'berry'
  | 'violet'
  | 'slate'
  | 'mint'
  | 'sky'
  | 'lavender'
  | 'blush'
  | 'sand'
  | 'neoBrutal'
  | 'terminal'
  | 'wedding'
  | 'royal'
  | 'crimson'
  | 'citrus'
  | 'magazine'
  | 'tamilClassic';

export interface BrandPreset {
  id: BrandPresetId;
  category: BrandPresetCategory;
  /** Quick-pick presets shown in the toolbar strip and drawer; the rest appear under "Show all themes". */
  featured?: boolean;
  tokens: Omit<FormDesignTokens, 'version'>;
}

/**
 * One-click starting points; every field is optional so a preset can be refined afterwards.
 * Each preset must stay a unique token set: `matchesPreset` identifies the active one by value.
 */
export const BRAND_PRESETS: BrandPreset[] = [
  {
    id: 'ocean',
    category: 'clean',
    featured: true,
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
    category: 'soft',
    featured: true,
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
    category: 'elegant',
    featured: true,
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
    category: 'clean',
    featured: true,
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
    category: 'bold',
    featured: true,
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
    category: 'clean',
    featured: true,
    tokens: {
      primaryColor: '#7c3aed',
      headingFont: 'space-grotesk',
      bodyFont: 'dm-sans',
      radius: 'lg',
      inputStyle: 'outlined',
      buttonStyle: 'soft',
    },
  },
  {
    id: 'slate',
    category: 'clean',
    tokens: {
      primaryColor: '#334155',
      surfaceColor: '#f8fafc',
      headingFont: 'inter',
      bodyFont: 'inter',
      radius: 'md',
      inputStyle: 'outlined',
      buttonStyle: 'solid',
    },
  },
  {
    id: 'mint',
    category: 'soft',
    tokens: {
      primaryColor: '#047857',
      surfaceColor: '#f0fdf4',
      headingFont: 'dm-sans',
      bodyFont: 'inter',
      radius: 'lg',
      inputStyle: 'filled',
      buttonStyle: 'soft',
    },
  },
  {
    id: 'sky',
    category: 'soft',
    tokens: {
      primaryColor: '#0369a1',
      surfaceColor: '#f0f9ff',
      headingFont: 'poppins',
      bodyFont: 'inter',
      radius: 'pill',
      inputStyle: 'outlined',
      buttonStyle: 'soft',
    },
  },
  {
    id: 'lavender',
    category: 'soft',
    tokens: {
      primaryColor: '#6d28d9',
      surfaceColor: '#f5f3ff',
      headingFont: 'dm-sans',
      bodyFont: 'dm-sans',
      radius: 'lg',
      inputStyle: 'filled',
      buttonStyle: 'soft',
    },
  },
  {
    id: 'blush',
    category: 'soft',
    tokens: {
      primaryColor: '#be123c',
      surfaceColor: '#fff1f2',
      headingFont: 'playfair',
      bodyFont: 'dm-sans',
      radius: 'lg',
      inputStyle: 'filled',
      buttonStyle: 'soft',
    },
  },
  {
    id: 'sand',
    category: 'elegant',
    tokens: {
      primaryColor: '#92400e',
      surfaceColor: '#fefce8',
      headingFont: 'merriweather',
      bodyFont: 'lora',
      radius: 'sm',
      inputStyle: 'underline',
      buttonStyle: 'solid',
    },
  },
  {
    id: 'neoBrutal',
    category: 'bold',
    tokens: {
      primaryColor: '#000000',
      surfaceColor: '#fef08a',
      headingFont: 'space-grotesk',
      bodyFont: 'space-grotesk',
      radius: 'none',
      inputStyle: 'outlined',
      buttonStyle: 'solid',
    },
  },
  {
    id: 'terminal',
    category: 'bold',
    tokens: {
      primaryColor: '#15803d',
      surfaceColor: '#f7fee7',
      headingFont: 'space-grotesk',
      bodyFont: 'space-grotesk',
      radius: 'none',
      inputStyle: 'underline',
      buttonStyle: 'outline',
    },
  },
  {
    id: 'wedding',
    category: 'elegant',
    tokens: {
      primaryColor: '#9a6b4b',
      surfaceColor: '#fdf8f3',
      headingFont: 'playfair',
      bodyFont: 'lora',
      radius: 'sm',
      inputStyle: 'underline',
      buttonStyle: 'outline',
    },
  },
  {
    id: 'royal',
    category: 'elegant',
    tokens: {
      primaryColor: '#1e3a8a',
      surfaceColor: '#eff6ff',
      headingFont: 'playfair',
      bodyFont: 'inter',
      radius: 'sm',
      inputStyle: 'outlined',
      buttonStyle: 'solid',
    },
  },
  {
    id: 'crimson',
    category: 'bold',
    tokens: {
      primaryColor: '#b91c1c',
      surfaceColor: '#fef2f2',
      headingFont: 'poppins',
      bodyFont: 'roboto',
      radius: 'md',
      inputStyle: 'outlined',
      buttonStyle: 'solid',
    },
  },
  {
    id: 'citrus',
    category: 'bold',
    tokens: {
      primaryColor: '#a16207',
      surfaceColor: '#fefce8',
      headingFont: 'poppins',
      bodyFont: 'dm-sans',
      radius: 'pill',
      inputStyle: 'filled',
      buttonStyle: 'solid',
    },
  },
  {
    id: 'magazine',
    category: 'elegant',
    tokens: {
      primaryColor: '#be123c',
      surfaceColor: '#fafaf9',
      headingFont: 'playfair',
      bodyFont: 'inter',
      radius: 'none',
      inputStyle: 'underline',
      buttonStyle: 'solid',
    },
  },
  {
    id: 'tamilClassic',
    category: 'clean',
    tokens: {
      primaryColor: '#b45309',
      surfaceColor: '#fffbeb',
      headingFont: 'noto-sans-tamil',
      bodyFont: 'mukta-malar',
      radius: 'md',
      inputStyle: 'outlined',
      buttonStyle: 'solid',
    },
  },
];

export const FEATURED_BRAND_PRESETS = BRAND_PRESETS.filter((preset) => preset.featured);

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
