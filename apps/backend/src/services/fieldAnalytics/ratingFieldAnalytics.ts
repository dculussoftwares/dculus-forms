/**
 * Rating Field Analytics Processor
 *
 * Processes analytics for RATING_FIELD: response count, average and the count per
 * value (including values nobody picked). A 0-10 number scale is an NPS question,
 * so it also gets the promoter / passive / detractor split and the NPS score.
 */

import { FieldType, isNpsRatingConfig, normalizeRatingConfig } from '@dculus/types';
import {
  FieldResponse,
  FieldAnalyticsBase,
  RatingFieldAnalytics,
  RatingFieldConfig,
  RatingNpsBreakdown,
} from './types.js';

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Process rating field analytics. `config` is the field's stored rating settings;
 * it is normalized here so a stale or hand-edited schema can't produce a bad range.
 */
export const processRatingFieldAnalytics = (
  fieldResponses: FieldResponse[],
  fieldId: string,
  fieldLabel: string,
  totalFormResponses: number,
  config?: RatingFieldConfig
): FieldAnalyticsBase & RatingFieldAnalytics => {
  const ratingConfig = normalizeRatingConfig(config ?? {});
  const { ratingStyle, minValue, maxValue } = ratingConfig;
  const isNps = isNpsRatingConfig(ratingConfig);

  // Only whole numbers inside the field's range count as ratings; anything else (a value
  // left over from before the range was narrowed, a stray string) is ignored.
  const counts = new Map<number, number>();
  for (let value = minValue; value <= maxValue; value += 1) counts.set(value, 0);

  let totalResponses = 0;
  let sum = 0;
  for (const response of fieldResponses) {
    const raw = response.value;
    if (raw === null || raw === undefined || raw === '') continue;
    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim() !== ''
          ? Number(raw)
          : NaN;
    if (!Number.isInteger(value) || value < minValue || value > maxValue) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
    totalResponses += 1;
    sum += value;
  }

  const distribution = Array.from(counts.entries()).map(([value, count]) => ({
    value,
    count,
    percentage: totalResponses > 0 ? round1((count / totalResponses) * 100) : 0,
  }));

  let nps: RatingNpsBreakdown | null = null;
  if (isNps) {
    const countOf = (from: number, to: number) => {
      let n = 0;
      for (let value = from; value <= to; value += 1) n += counts.get(value) ?? 0;
      return n;
    };
    const promoters = countOf(9, 10);
    const passives = countOf(7, 8);
    const detractors = countOf(0, 6);
    const pct = (n: number) => (totalResponses > 0 ? (n / totalResponses) * 100 : 0);
    nps = {
      promoters,
      passives,
      detractors,
      promoterPercentage: round1(pct(promoters)),
      passivePercentage: round1(pct(passives)),
      detractorPercentage: round1(pct(detractors)),
      // Computed from the unrounded shares so the score doesn't drift by rounding
      score: round1(pct(promoters) - pct(detractors)),
    };
  }

  return {
    fieldId,
    fieldType: FieldType.RATING_FIELD,
    fieldLabel,
    totalResponses,
    responseRate: totalFormResponses > 0 ? (totalResponses / totalFormResponses) * 100 : 0,
    lastUpdated: new Date(),
    ratingStyle,
    minValue,
    maxValue,
    average: totalResponses > 0 ? round2(sum / totalResponses) : 0,
    distribution,
    isNps,
    nps,
  };
};
