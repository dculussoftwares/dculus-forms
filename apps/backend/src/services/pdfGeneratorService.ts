import { generateId } from '@dculus/utils';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { ResponseFilter, applyResponseFilters } from './responseFilterService.js';
import { getAllResponsesByFormId } from './responseService.js';
import { deleteGeneratedPdfsForGenerator } from './pdfGeneratorStorage.js';

export interface PdfGeneratorInput {
  formId: string;
  templateId: string;
  name: string;
  columnName?: string | null;
  filenameFieldId?: string | null;
  filters: ResponseFilter[];
  filterLogic?: 'AND' | 'OR';
  autoRunOnSubmit?: boolean;
}

export interface PdfGeneratorUpdateInput {
  templateId?: string;
  name?: string;
  columnName?: string | null;
  filenameFieldId?: string | null;
  filters?: ResponseFilter[];
  filterLogic?: 'AND' | 'OR';
  autoRunOnSubmit?: boolean;
  enabled?: boolean;
}

// Empty-string column name / filename field means "unset" — normalize to null
// rather than persisting an empty string, so field resolvers' `?? name` /
// `?? default` fallbacks kick in consistently.
const normalizeOptionalString = (value: string | null | undefined): string | null | undefined =>
  value === '' ? null : value;

export const createPdfGenerator = async (input: PdfGeneratorInput) => {
  const template = await prisma.pdfTemplate.findUnique({ where: { id: input.templateId } });
  if (!template || template.formId !== input.formId) {
    throw createGraphQLError('PDF template not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }

  return prisma.pdfGenerator.create({
    data: {
      id: generateId(),
      formId: input.formId,
      templateId: input.templateId,
      name: input.name,
      columnName: normalizeOptionalString(input.columnName) ?? null,
      filenameFieldId: normalizeOptionalString(input.filenameFieldId) ?? null,
      filters: input.filters as any,
      filterLogic: input.filterLogic ?? 'AND',
      autoRunOnSubmit: input.autoRunOnSubmit ?? false,
    },
  });
};

export const updatePdfGenerator = async (id: string, input: PdfGeneratorUpdateInput) => {
  const generator = await prisma.pdfGenerator.findUnique({ where: { id } });
  if (!generator) {
    throw createGraphQLError('PDF generator not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }

  if (input.templateId) {
    const template = await prisma.pdfTemplate.findUnique({ where: { id: input.templateId } });
    if (!template || template.formId !== generator.formId) {
      throw createGraphQLError('PDF template not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
    }
  }

  // Column name is locked once set — it's the Responses table's column
  // header, and changing it after responses/exports have referenced it would
  // be confusing. Setting it for the first time (from unset) is still allowed.
  if (
    generator.columnName &&
    input.columnName !== undefined &&
    normalizeOptionalString(input.columnName) !== generator.columnName
  ) {
    throw createGraphQLError(
      'Column name cannot be changed once set',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  return prisma.pdfGenerator.update({
    where: { id },
    data: {
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.columnName !== undefined ? { columnName: normalizeOptionalString(input.columnName) } : {}),
      ...(input.filenameFieldId !== undefined
        ? { filenameFieldId: normalizeOptionalString(input.filenameFieldId) }
        : {}),
      ...(input.filters !== undefined ? { filters: input.filters as any } : {}),
      ...(input.filterLogic !== undefined ? { filterLogic: input.filterLogic } : {}),
      ...(input.autoRunOnSubmit !== undefined ? { autoRunOnSubmit: input.autoRunOnSubmit } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    },
  });
};

export const deletePdfGenerator = async (id: string): Promise<boolean> => {
  const generator = await prisma.pdfGenerator.findUnique({ where: { id } });
  if (!generator) {
    throw createGraphQLError('PDF generator not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }

  await prisma.pdfGenerator.delete({ where: { id } });

  try {
    await deleteGeneratedPdfsForGenerator(generator.formId, generator.id);
  } catch (error) {
    logger.warn(`Failed to clean up generated PDFs for generator ${id}:`, error);
  }

  return true;
};

export const listPdfGenerators = async (formId: string) => {
  return prisma.pdfGenerator.findMany({ where: { formId }, orderBy: { createdAt: 'desc' } });
};

export const getPdfGenerator = async (id: string) => {
  return prisma.pdfGenerator.findUnique({ where: { id } });
};

/**
 * Count how many of a form's (non-deleted) responses match a filter set.
 * Reuses the same in-memory filter pass unifiedExportService uses — adequate
 * since this is a live "N of M responses match" UI count, not a hot path.
 */
export const countMatchingResponses = async (
  formId: string,
  filters: ResponseFilter[],
  filterLogic: 'AND' | 'OR' = 'AND'
): Promise<number> => {
  const responses = await getAllResponsesByFormId(formId);
  return applyResponseFilters(responses, filters, filterLogic).length;
};

/**
 * Resolve the responses a generator's filter currently matches (id + data) —
 * used to seed a bulk PdfGenerationRun without re-fetching each response
 * individually inside the job loop.
 */
export const getMatchingResponses = async (
  formId: string,
  filters: ResponseFilter[],
  filterLogic: 'AND' | 'OR' = 'AND'
): Promise<{ id: string; data: Record<string, any> }[]> => {
  const responses = await getAllResponsesByFormId(formId);
  return applyResponseFilters(responses, filters, filterLogic).map((r) => ({
    id: r.id,
    data: r.data as Record<string, any>,
  }));
};
