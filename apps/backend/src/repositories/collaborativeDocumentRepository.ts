import type { Prisma } from '#prisma-client';
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
    // Prisma's generated `Bytes` type is `Uint8Array<ArrayBuffer>`, while
    // Node's `Buffer` type is generic over `ArrayBufferLike` (which also
    // covers `SharedArrayBuffer`), so TS no longer considers `Buffer`
    // structurally assignable. The runtime value is unaffected — `Buffer`
    // instances are `Uint8Array`s — this only widens the type for Prisma.
    const bytes = state as unknown as Uint8Array<ArrayBuffer>;
    return prisma.collaborativeDocument.upsert({
      where: { documentName },
      update: { state: bytes, updatedAt: new Date() },
      create: { id: idFactory(documentName), documentName, state: bytes, updatedAt: new Date() },
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
