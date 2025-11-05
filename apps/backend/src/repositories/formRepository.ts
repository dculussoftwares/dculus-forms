import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createFormRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  return {
    findMany: <T extends Prisma.FormFindManyArgs>(
      args?: Prisma.SelectSubset<T, Prisma.FormFindManyArgs>
    ) => prisma.form.findMany(args),
    findUnique: <T extends Prisma.FormFindUniqueArgs>(
      args: Prisma.SelectSubset<T, Prisma.FormFindUniqueArgs>
    ) => prisma.form.findUnique(args),
    findFirst: <T extends Prisma.FormFindFirstArgs>(
      args: Prisma.SelectSubset<T, Prisma.FormFindFirstArgs>
    ) => prisma.form.findFirst(args),
    create: <T extends Prisma.FormCreateArgs>(
      args: Prisma.SelectSubset<T, Prisma.FormCreateArgs>
    ) => prisma.form.create(args),
    update: <T extends Prisma.FormUpdateArgs>(
      args: Prisma.SelectSubset<T, Prisma.FormUpdateArgs>
    ) => prisma.form.update(args),
    delete: <T extends Prisma.FormDeleteArgs>(
      args: Prisma.SelectSubset<T, Prisma.FormDeleteArgs>
    ) => prisma.form.delete(args),
    count: <T extends Prisma.FormCountArgs>(
      args?: Prisma.SelectSubset<T, Prisma.FormCountArgs>
    ) => prisma.form.count(args),
    createPermission: <T extends Prisma.FormPermissionCreateArgs>(
      args: Prisma.SelectSubset<T, Prisma.FormPermissionCreateArgs>
    ) => prisma.formPermission.create(args),
    createFile: <T extends Prisma.FormFileCreateArgs>(
      args: Prisma.SelectSubset<T, Prisma.FormFileCreateArgs>
    ) => prisma.formFile.create(args),
  };
};

export type FormRepository = ReturnType<typeof createFormRepository>;

export const formRepository = createFormRepository();
