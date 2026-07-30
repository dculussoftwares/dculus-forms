import type { Prisma } from '#prisma-client';
import { formFileRepository } from '../repositories/index.js';

/**
 * List a form's files, most recent first, optionally filtered by type
 * (e.g. `FormBackground`, `FormResponse`). Caller is responsible for
 * validating `type` against the allowed set before calling.
 */
export const listFormFiles = async (formId: string, type?: string) =>
  formFileRepository.listByFormId(formId, type);

export const findFormFileById = async (id: string) =>
  formFileRepository.findById(id);

export const createFormFile = async (
  data: Prisma.FormFileCreateArgs['data']
) => formFileRepository.createFormFile(data);
