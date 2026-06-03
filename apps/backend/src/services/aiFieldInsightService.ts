import { createHash } from 'crypto';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getPrimaryModel } from '../lib/ai.js';
import { logger } from '../lib/logger.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FieldInsight {
  fieldId: string;
  tip: string;
  fixPrompt: string;
  severity: 'warning' | 'error' | 'success' | 'info';
  generatedAt: string;
}

export interface FieldInsightsResult {
  insights: FieldInsight[];
  schemaStale: boolean;
  generatedAt: string | null;
  tokensUsed?: number;
}

// ── Schema hash ───────────────────────────────────────────────────────────

export function computeSchemaHash(schema: { pages: any[] }): string {
  const fingerprint = (schema.pages ?? [])
    .flatMap((p: any) => p.fields ?? [])
    .map((f: any) => `${f.id}:${f.type}:${f.label}`)
    .join('|');
  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);
}

// ── Read ─────────────────────────────────────────────────────────────────

export async function getFieldInsights(
  formId: string,
  currentSchemaHash: string
): Promise<FieldInsightsResult> {
  const rows = await prisma.aIFieldInsight.findMany({
    where: { formId },
    orderBy: { generatedAt: 'asc' },
  });

  if (rows.length === 0) {
    return { insights: [], schemaStale: false, generatedAt: null };
  }

  const schemaStale = rows.some((r) => r.schemaHash !== currentSchemaHash);
  const earliest = rows[0].generatedAt.toISOString();

  return {
    insights: rows.map((r) => ({
      fieldId: r.fieldId,
      tip: r.tip,
      fixPrompt: r.fixPrompt,
      severity: r.severity as FieldInsight['severity'],
      generatedAt: r.generatedAt.toISOString(),
    })),
    schemaStale,
    generatedAt: earliest,
  };
}

// ── Generate ──────────────────────────────────────────────────────────────

const InsightRowSchema = z.object({
  fieldId: z.string(),
  tip: z.string().max(200),
  fixPrompt: z.string().max(250),
  severity: z.enum(['warning', 'error', 'success', 'info']),
});

const InsightsOutputSchema = z.object({
  insights: z.array(InsightRowSchema),
});

export async function generateFieldInsights(
  formId: string,
  formTitle: string,
  schema: { pages: any[] },
  _totalResponses: number
): Promise<FieldInsightsResult & { tokensUsed: number }> {
  const allFields = (schema.pages ?? []).flatMap((p: any) => p.fields ?? []);

  if (allFields.length === 0) {
    return { insights: [], schemaStale: false, generatedAt: null, tokensUsed: 0 };
  }

  // Load responses to compute per-field stats
  const responses = await prisma.response.findMany({
    where: { formId, deletedAt: null },
    select: { data: true },
  });

  const total = responses.length;

  // Build compact stats per field
  const fieldRows = allFields.map((field: any) => {
    const values = responses
      .map((r) => (r.data as Record<string, any>)[field.id])
      .filter((v) => v !== null && v !== undefined && v !== '');

    const fillRate = total > 0 ? Math.round((values.length / total) * 100) : 0;

    // Average word count for text-like fields
    let avgLen = '-';
    if (['text_input_field', 'text_area_field', 'email_field', 'TEXT_INPUT_FIELD', 'TEXT_AREA_FIELD', 'EMAIL_FIELD'].includes(field.type)) {
      if (values.length > 0) {
        const avg = values.reduce((sum: number, v: any) => sum + String(v).split(/\s+/).filter(Boolean).length, 0) / values.length;
        avgLen = `${avg.toFixed(1)} words`;
      }
    }

    // Top options for choice fields
    let topOptions = '-';
    if (['select_field', 'radio_field', 'checkbox_field', 'SELECT_FIELD', 'RADIO_FIELD', 'CHECKBOX_FIELD'].includes(field.type)) {
      const counts: Record<string, number> = {};
      values.forEach((v: any) => {
        const opts = Array.isArray(v) ? v : [v];
        opts.forEach((o: string) => { counts[o] = (counts[o] ?? 0) + 1; });
      });
      topOptions = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([opt, cnt]) => `${opt}:${Math.round((cnt / (values.length || 1)) * 100)}%`)
        .join(', ') || '-';
    }

    const shortType = field.type
      .toLowerCase()
      .replace('_field', '')
      .replace('_input', '')
      .replace('_area', 'area')
      .replace('_upload', 'upload');

    return `${field.id} | ${shortType} | "${field.label}" | ${fillRate}% fill | ${avgLen} | ${topOptions}`;
  });

  const prompt = [
    `Form: "${formTitle}" — ${total} total responses`,
    '',
    'fieldId | type | label | fillRate | avgLen | topOptions',
    ...fieldRows,
    '',
    'For EACH field: write a 1-2 sentence actionable insight (tip, max 180 chars) and a direct instruction message (fixPrompt, max 220 chars) the form editor AI can act on.',
    'severity: "error" if fillRate <30%, "warning" if fillRate 30-60% or "Other" option >25%, "success" if field is healthy with an improvement opportunity, "info" otherwise.',
  ].join('\n');

  const { output, usage } = await generateText({
    model: getPrimaryModel(),
    output: Output.object({ schema: InsightsOutputSchema }),
    system:
      'You are a form analytics expert. Analyse the field stats and generate concise, actionable insights to improve form completion and data quality. Return ONLY valid JSON matching the schema.',
    prompt,
  });

  const tokensUsed = usage?.totalTokens ?? 0;
  const schemaHash = computeSchemaHash(schema);
  const now = new Date();

  // Upsert all rows
  await Promise.all(
    output.insights.map((ins) =>
      prisma.aIFieldInsight.upsert({
        where: { formId_fieldId: { formId, fieldId: ins.fieldId } },
        update: {
          tip: ins.tip,
          fixPrompt: ins.fixPrompt,
          severity: ins.severity,
          schemaHash,
          generatedAt: now,
        },
        create: {
          formId,
          fieldId: ins.fieldId,
          tip: ins.tip,
          fixPrompt: ins.fixPrompt,
          severity: ins.severity,
          schemaHash,
          generatedAt: now,
        },
      })
    )
  );

  logger.info({ formId, fieldCount: allFields.length, tokensUsed }, 'AI field insights generated');

  return {
    insights: output.insights.map((ins) => ({
      ...ins,
      generatedAt: now.toISOString(),
    })),
    schemaStale: false,
    generatedAt: now.toISOString(),
    tokensUsed,
  };
}
