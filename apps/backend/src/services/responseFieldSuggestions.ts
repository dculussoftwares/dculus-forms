/**
 * Distinct-value suggestions for the response meta-filter value input's dropdown-plus-
 * free-text combobox (FilterRow's AsyncValueCombobox) — lets a filter's text value be
 * picked from what's actually in the data instead of typed blind, while still allowing
 * arbitrary free text (a value not yet seen, or a CONTAINS/STARTS_WITH fragment).
 *
 * Only a fixed allowlist of fieldIds support suggestions (a real, boundable value set —
 * browser/OS/country names, editor/respondent emails); anything else returns [] rather
 * than erroring, so a caller can call this unconditionally without checking first.
 */
import { prisma } from '../lib/prisma.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export const SUGGESTIBLE_FIELD_IDS = new Set([
  '__browser',
  '__operatingSystem',
  '__country',
  '__lastEditedByEmail',
  '__respondentEmail',
]);

export async function getDistinctResponseFieldValues(
  formId: string,
  fieldId: string,
  search?: string,
  limit: number = DEFAULT_LIMIT
): Promise<string[]> {
  const cappedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  // ILIKE pattern — undefined/empty search matches everything (initial "most values" load).
  const pattern = `%${search ?? ''}%`;

  switch (fieldId) {
    case '__browser': {
      const rows = await prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT browser AS value
        FROM "form_submission_analytics"
        WHERE "formId" = ${formId} AND browser IS NOT NULL AND browser != '' AND browser ILIKE ${pattern}
        ORDER BY browser
        LIMIT ${cappedLimit}
      `;
      return rows.map((r) => r.value);
    }
    case '__operatingSystem': {
      const rows = await prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT "operatingSystem" AS value
        FROM "form_submission_analytics"
        WHERE "formId" = ${formId} AND "operatingSystem" IS NOT NULL AND "operatingSystem" != '' AND "operatingSystem" ILIKE ${pattern}
        ORDER BY "operatingSystem"
        LIMIT ${cappedLimit}
      `;
      return rows.map((r) => r.value);
    }
    case '__country': {
      const rows = await prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT "countryAlpha2" AS value
        FROM "form_submission_analytics"
        WHERE "formId" = ${formId} AND "countryAlpha2" IS NOT NULL AND "countryAlpha2" != '' AND "countryAlpha2" ILIKE ${pattern}
        ORDER BY "countryAlpha2"
        LIMIT ${cappedLimit}
      `;
      return rows.map((r) => r.value);
    }
    case '__lastEditedByEmail': {
      const rows = await prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT u.email AS value
        FROM "response_edit_history" reh
        JOIN "response" r ON r.id = reh."responseId"
        JOIN "user" u ON u.id = reh."editedById"
        WHERE r."formId" = ${formId} AND u.email ILIKE ${pattern}
        ORDER BY u.email
        LIMIT ${cappedLimit}
      `;
      return rows.map((r) => r.value);
    }
    case '__respondentEmail': {
      const rows = await prisma.$queryRaw<{ value: string }[]>`
        SELECT DISTINCT "respondentEmail" AS value
        FROM "response"
        WHERE "formId" = ${formId} AND "deletedAt" IS NULL AND "respondentEmail" IS NOT NULL AND "respondentEmail" ILIKE ${pattern}
        ORDER BY "respondentEmail"
        LIMIT ${cappedLimit}
      `;
      return rows.map((r) => r.value);
    }
    default:
      return [];
  }
}
