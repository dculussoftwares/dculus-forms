// Leaf module (no imports) so schemas built at module load can use these without an import cycle.
// Holds the rating field's pure config rules; the RatingField class itself lives in index.ts.
/** Bounds for a rating field's highest value. Stars always start at 1; a scale may start at 0 or 1. */
export const RATING_MAX_VALUE_MIN = 3;
export const RATING_MAX_VALUE_MAX = 10;
export const RATING_DEFAULT_MAX_VALUE = 5;

/** How a rating field is drawn: a row of stars, or a row of numbered buttons. */
export type RatingStyle = 'stars' | 'scale';

export interface RatingConfig {
  ratingStyle: RatingStyle;
  minValue: 0 | 1;
  maxValue: number;
}

/**
 * Turns any stored rating settings into a valid config. Stars always run 1..max;
 * a scale runs 0..max or 1..max; max is clamped to 3..10 (default 5).
 */
export const normalizeRatingConfig = (input: object | null | undefined): RatingConfig => {
  const data = (input ?? {}) as { ratingStyle?: unknown; minValue?: unknown; maxValue?: unknown };
  const ratingStyle: RatingStyle = data?.ratingStyle === 'scale' ? 'scale' : 'stars';
  // null / '' / undefined mean "not set" (Number(null) and Number('') are 0, which must not clamp to 3)
  const rawMax =
    data?.maxValue === null || data?.maxValue === undefined || data?.maxValue === ''
      ? NaN
      : Number(data.maxValue);
  const maxValue = Number.isInteger(rawMax)
    ? Math.min(RATING_MAX_VALUE_MAX, Math.max(RATING_MAX_VALUE_MIN, rawMax))
    : RATING_DEFAULT_MAX_VALUE;
  const minValue: 0 | 1 = ratingStyle === 'scale' && Number(data?.minValue) === 0 ? 0 : 1;
  return { ratingStyle, minValue, maxValue };
};

/** A 0–10 number scale is treated as Net Promoter Score in analytics. */
export const isNpsRatingConfig = (config: RatingConfig): boolean =>
  config.ratingStyle === 'scale' && config.minValue === 0 && config.maxValue === 10;

