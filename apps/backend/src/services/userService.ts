import type { Prisma } from '#prisma-client';
import { userRepository } from '../repositories/userRepository.js';

/**
 * User Service
 * Thin service layer over userRepository for the admin user-management
 * flows in `admin.ts` and the avatar-ownership check in `fileUpload.ts`.
 */

export const listUsers = <T extends Prisma.UserFindManyArgs>(
  args: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>
) => userRepository.findMany(args);

export const countUsers = <T extends Prisma.UserCountArgs>(
  args?: Prisma.SelectSubset<T, Prisma.UserCountArgs>
) => userRepository.count(args);

export const getUserDetail = <T extends Prisma.UserFindUniqueArgs>(
  args: Prisma.SelectSubset<T, Prisma.UserFindUniqueArgs>
) => userRepository.findUnique(args);

export const findUserByImageKey = (imageKey: string) =>
  userRepository.findByImageKey(imageKey);
