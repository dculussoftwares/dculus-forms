import type { FormFontId } from '@dculus/types';

export interface FontCatalogEntry {
  id: FormFontId;
  label: string;
  /** Full CSS `font-family` stack. */
  stack: string;
  /** Google Fonts family name (with `+` for spaces); absent when no network load is needed. */
  googleFamily?: string;
  supportsTamil: boolean;
}

const SANS_FALLBACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF_FALLBACK = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

// Inter is already loaded by every app's index.html, so it has no googleFamily.
export const FONT_CATALOG: Record<FormFontId, FontCatalogEntry> = {
  inter: {
    id: 'inter',
    label: 'Inter',
    stack: `"Inter", ${SANS_FALLBACK}`,
    supportsTamil: false,
  },
  roboto: {
    id: 'roboto',
    label: 'Roboto',
    stack: `"Roboto", ${SANS_FALLBACK}`,
    googleFamily: 'Roboto',
    supportsTamil: false,
  },
  poppins: {
    id: 'poppins',
    label: 'Poppins',
    stack: `"Poppins", ${SANS_FALLBACK}`,
    googleFamily: 'Poppins',
    supportsTamil: false,
  },
  lora: {
    id: 'lora',
    label: 'Lora',
    stack: `"Lora", ${SERIF_FALLBACK}`,
    googleFamily: 'Lora',
    supportsTamil: false,
  },
  playfair: {
    id: 'playfair',
    label: 'Playfair Display',
    stack: `"Playfair Display", ${SERIF_FALLBACK}`,
    googleFamily: 'Playfair+Display',
    supportsTamil: false,
  },
  merriweather: {
    id: 'merriweather',
    label: 'Merriweather',
    stack: `"Merriweather", ${SERIF_FALLBACK}`,
    googleFamily: 'Merriweather',
    supportsTamil: false,
  },
  'space-grotesk': {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    stack: `"Space Grotesk", ${SANS_FALLBACK}`,
    googleFamily: 'Space+Grotesk',
    supportsTamil: false,
  },
  'dm-sans': {
    id: 'dm-sans',
    label: 'DM Sans',
    stack: `"DM Sans", ${SANS_FALLBACK}`,
    googleFamily: 'DM+Sans',
    supportsTamil: false,
  },
  'noto-sans-tamil': {
    id: 'noto-sans-tamil',
    label: 'Noto Sans Tamil',
    stack: `"Noto Sans Tamil", ${SANS_FALLBACK}`,
    googleFamily: 'Noto+Sans+Tamil',
    supportsTamil: true,
  },
  'mukta-malar': {
    id: 'mukta-malar',
    label: 'Mukta Malar',
    stack: `"Mukta Malar", ${SANS_FALLBACK}`,
    googleFamily: 'Mukta+Malar',
    supportsTamil: true,
  },
  system: {
    id: 'system',
    label: 'System',
    stack: SANS_FALLBACK,
    supportsTamil: true,
  },
};

export const FONT_IDS = Object.keys(FONT_CATALOG) as FormFontId[];

/** CSS `font-family` stack for a catalog font id. */
export function getFontStack(id: FormFontId): string {
  return (FONT_CATALOG[id] ?? FONT_CATALOG.system).stack;
}

/**
 * One combined Google Fonts CSS URL for all fonts that need a network load
 * (deduped; `inter` and `system` are skipped). Returns `null` when none do.
 */
export function getGoogleFontsHref(ids: ReadonlyArray<FormFontId | undefined>): string | null {
  const families = new Set<string>();
  for (const id of ids) {
    const family = id ? FONT_CATALOG[id]?.googleFamily : undefined;
    if (family) families.add(family);
  }
  if (families.size === 0) return null;
  const query = [...families]
    .sort()
    .map((family) => `family=${family}:wght@400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
