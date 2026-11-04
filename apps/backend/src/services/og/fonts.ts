import { readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

export interface OgFont {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700 | 800;
  style: 'normal';
}

let cache: OgFont[] | null = null;

const inter = (weight: OgFont['weight']): OgFont => ({
  name: 'Inter',
  data: readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`)),
  weight,
  style: 'normal',
});

/**
 * Inter for Latin text, Noto Sans Tamil as the fallback for Tamil titles (the app
 * ships en + ta). Satori falls through the list per glyph. Loaded once.
 * The Tamil font is the same file the PDF generator uses (apps/backend/assets/fonts);
 * the path works from src/ (tsx) and dist/apps/backend/src/ (build copies assets/).
 */
export const loadOgFonts = (): OgFont[] => {
  if (cache) return cache;
  const candidates = [
    path.resolve(here, '../../../assets/fonts/NotoSansTamil-Regular.ttf'),
    path.resolve(here, '../../../../assets/fonts/NotoSansTamil-Regular.ttf'),
    path.resolve(process.cwd(), 'assets/fonts/NotoSansTamil-Regular.ttf'),
  ];
  const fonts: OgFont[] = [inter(400), inter(600), inter(700), inter(800)];
  for (const candidate of candidates) {
    try {
      fonts.push({ name: 'Noto Sans Tamil', data: readFileSync(candidate), weight: 400, style: 'normal' });
      break;
    } catch {
      // try the next location
    }
  }
  cache = fonts;
  return fonts;
};
