import { createRepository, type RepositoryContext } from './baseRepository.js';

export const createCollaborativeDocumentRepository = (
  context?: RepositoryContext
) => createRepository((client) => client.collaborativeDocument, context);

export type CollaborativeDocumentRepository = ReturnType<
  typeof createCollaborativeDocumentRepository
>;

export const collaborativeDocumentRepository =
  createCollaborativeDocumentRepository();

