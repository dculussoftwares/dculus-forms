import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createCollaborativeDocumentRepository = (
  context?: RepositoryContext
) => {
  const prisma = resolvePrisma(context);

  const findUnique = <T extends Prisma.CollaborativeDocumentFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.CollaborativeDocumentFindUniqueArgs>
  ) => prisma.collaborativeDocument.findUnique(args);

  const findMany = <T extends Prisma.CollaborativeDocumentFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.CollaborativeDocumentFindManyArgs>
  ) => prisma.collaborativeDocument.findMany(args);

  const create = <T extends Prisma.CollaborativeDocumentCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.CollaborativeDocumentCreateArgs>
  ) => prisma.collaborativeDocument.create(args);

  const update = <T extends Prisma.CollaborativeDocumentUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.CollaborativeDocumentUpdateArgs>
  ) => prisma.collaborativeDocument.update(args);

  const fetchDocumentWithState = async (documentName: string) =>
    prisma.collaborativeDocument.findUnique({
      where: { documentName },
      select: { state: true, id: true, updatedAt: true },
    });

  const listDocumentNames = async () =>
    prisma.collaborativeDocument.findMany({
      select: { documentName: true, id: true },
    });

  const saveDocumentState = async (
    documentName: string,
    state: Buffer,
    idFactory: (documentName: string) => string
  ) => {
    const existing = await prisma.collaborativeDocument.findUnique({
      where: { documentName },
      select: { documentName: true },
    });

    if (existing) {
      return prisma.collaborativeDocument.update({
        where: { documentName },
        data: {
          state,
          updatedAt: new Date(),
        },
      });
    }

    return prisma.collaborativeDocument.create({
      data: {
        id: idFactory(documentName),
        documentName,
        state,
        updatedAt: new Date(),
      },
    });
  };

  return {
    findUnique,
    findMany,
    create,
    update,
    fetchDocumentWithState,
    listDocumentNames,
    saveDocumentState,
  };
};

export type CollaborativeDocumentRepository = ReturnType<
  typeof createCollaborativeDocumentRepository
>;

export const collaborativeDocumentRepository =
  createCollaborativeDocumentRepository();
