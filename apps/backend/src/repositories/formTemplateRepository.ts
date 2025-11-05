import { createRepository, type RepositoryContext } from './baseRepository.js';

export const createFormTemplateRepository = (context?: RepositoryContext) =>
  createRepository((client) => client.formTemplate, context);

export type FormTemplateRepository = ReturnType<
  typeof createFormTemplateRepository
>;

export const formTemplateRepository = createFormTemplateRepository();

