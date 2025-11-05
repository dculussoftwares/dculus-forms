import { createRepository, type RepositoryContext } from './baseRepository.js';

export const createFormMetadataRepository = (context?: RepositoryContext) =>
  createRepository((client) => client.formMetadata, context);

export type FormMetadataRepository = ReturnType<
  typeof createFormMetadataRepository
>;

export const formMetadataRepository = createFormMetadataRepository();

