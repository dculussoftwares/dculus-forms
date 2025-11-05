import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createResponseRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  return {
    findMany: <T extends Prisma.ResponseFindManyArgs>(
      args?: Prisma.SelectSubset<T, Prisma.ResponseFindManyArgs>
    ) => prisma.response.findMany(args),
    findUnique: <T extends Prisma.ResponseFindUniqueArgs>(
      args: Prisma.SelectSubset<T, Prisma.ResponseFindUniqueArgs>
    ) => prisma.response.findUnique(args),
    count: <T extends Prisma.ResponseCountArgs>(
      args?: Prisma.SelectSubset<T, Prisma.ResponseCountArgs>
    ) => prisma.response.count(args),
    create: <T extends Prisma.ResponseCreateArgs>(
      args: Prisma.SelectSubset<T, Prisma.ResponseCreateArgs>
    ) => prisma.response.create(args),
    update: <T extends Prisma.ResponseUpdateArgs>(
      args: Prisma.SelectSubset<T, Prisma.ResponseUpdateArgs>
    ) => prisma.response.update(args),
    delete: <T extends Prisma.ResponseDeleteArgs>(
      args: Prisma.SelectSubset<T, Prisma.ResponseDeleteArgs>
    ) => prisma.response.delete(args),
    createEditHistory: <T extends Prisma.ResponseEditHistoryCreateArgs>(
      args: Prisma.SelectSubset<T, Prisma.ResponseEditHistoryCreateArgs>
    ) => prisma.responseEditHistory.create(args),
    findEditHistory: <T extends Prisma.ResponseEditHistoryFindManyArgs>(
      args: Prisma.SelectSubset<T, Prisma.ResponseEditHistoryFindManyArgs>
    ) => prisma.responseEditHistory.findMany(args),
    createFieldChange: <T extends Prisma.ResponseFieldChangeCreateArgs>(
      args: Prisma.SelectSubset<T, Prisma.ResponseFieldChangeCreateArgs>
    ) => prisma.responseFieldChange.create(args),
  };
};

export type ResponseRepository = ReturnType<typeof createResponseRepository>;

export const responseRepository = createResponseRepository();
