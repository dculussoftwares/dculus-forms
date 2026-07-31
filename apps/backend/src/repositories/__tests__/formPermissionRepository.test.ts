import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFormPermissionRepository } from '../formPermissionRepository.js';

const prismaMock = vi.hoisted(() => ({
  formPermission: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
    upsert: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

vi.mock('../baseRepository.js', () => ({
  resolvePrisma: () => prismaMock,
}));

describe('formPermissionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.formPermission.findMany.mockResolvedValue([]);
    prismaMock.formPermission.findUnique.mockResolvedValue(null);
    prismaMock.formPermission.create.mockResolvedValue({});
    prismaMock.formPermission.update.mockResolvedValue({});
    prismaMock.formPermission.delete.mockResolvedValue({});
    prismaMock.formPermission.count.mockResolvedValue(0);
    prismaMock.formPermission.upsert.mockResolvedValue({});
    prismaMock.formPermission.createMany.mockResolvedValue({ count: 0 });
    prismaMock.formPermission.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('should proxy generic delegate methods', async () => {
    const repo = createFormPermissionRepository();
    const args = { where: { id: 'perm-1' } };

    await repo.findMany(args);
    await repo.findUnique(args as any);
    await repo.create({ data: { formId: 'form-1' } } as any);
    await repo.update({ where: { id: 'perm-1' }, data: { permission: 'EDITOR' } } as any);
    await repo.delete({ where: { id: 'perm-1' } } as any);
    await repo.count(args as any);
    await repo.upsert({ where: { id: 'perm-1' }, update: {}, create: {} } as any);
    await repo.createMany({ data: [] } as any);
    await repo.deleteMany({ where: { formId: 'form-1' } } as any);

    expect(prismaMock.formPermission.findMany).toHaveBeenCalledWith(args);
    expect(prismaMock.formPermission.findUnique).toHaveBeenCalledWith(args);
    expect(prismaMock.formPermission.create).toHaveBeenCalled();
    expect(prismaMock.formPermission.update).toHaveBeenCalled();
    expect(prismaMock.formPermission.delete).toHaveBeenCalled();
    expect(prismaMock.formPermission.count).toHaveBeenCalledWith(args);
    expect(prismaMock.formPermission.upsert).toHaveBeenCalled();
    expect(prismaMock.formPermission.createMany).toHaveBeenCalledWith({ data: [] });
    expect(prismaMock.formPermission.deleteMany).toHaveBeenCalledWith({ where: { formId: 'form-1' } });
  });

  describe('findByForm', () => {
    it('returns every grant for a form, newest first, with grantee + granter loaded', async () => {
      const repo = createFormPermissionRepository();
      const mockPermissions = [{ id: 'perm-1', formId: 'form-1' }];
      prismaMock.formPermission.findMany.mockResolvedValueOnce(mockPermissions);

      const result = await repo.findByForm('form-1');

      expect(prismaMock.formPermission.findMany).toHaveBeenCalledWith({
        where: { formId: 'form-1' },
        include: { user: true, grantedBy: true },
        orderBy: { grantedAt: 'desc' },
      });
      expect(result).toEqual(mockPermissions);
    });
  });

  describe('removeManyForUsers', () => {
    it('deletes permissions for a form scoped to a set of users', async () => {
      const repo = createFormPermissionRepository();

      await repo.removeManyForUsers('form-1', ['user-1', 'user-2']);

      expect(prismaMock.formPermission.deleteMany).toHaveBeenCalledWith({
        where: { formId: 'form-1', userId: { in: ['user-1', 'user-2'] } },
      });
    });
  });

  describe('removeForUser', () => {
    it('deletes a single user permission on a form', async () => {
      const repo = createFormPermissionRepository();

      await repo.removeForUser('form-1', 'user-1');

      expect(prismaMock.formPermission.deleteMany).toHaveBeenCalledWith({
        where: { formId: 'form-1', userId: 'user-1' },
      });
    });
  });

  describe('createManyForUsers', () => {
    it('bulk-creates permission grants', async () => {
      const repo = createFormPermissionRepository();
      const data = [
        { id: 'perm-1', formId: 'form-1', userId: 'user-1', permission: 'EDITOR', grantedById: 'owner-1' },
      ];

      await repo.createManyForUsers(data as any);

      expect(prismaMock.formPermission.createMany).toHaveBeenCalledWith({ data });
    });
  });

  describe('upsertForUser', () => {
    it('updates an existing grant with the same shape used to create it', async () => {
      const repo = createFormPermissionRepository();
      const upserted = { id: 'perm-1', formId: 'form-1', userId: 'user-1', permission: 'EDITOR' };
      prismaMock.formPermission.upsert.mockResolvedValueOnce(upserted);

      const result = await repo.upsertForUser('form-1', 'user-1', 'EDITOR', 'owner-1');

      expect(prismaMock.formPermission.upsert).toHaveBeenCalledWith({
        where: { formId_userId: { formId: 'form-1', userId: 'user-1' } },
        update: { permission: 'EDITOR', grantedById: 'owner-1' },
        create: expect.objectContaining({
          formId: 'form-1',
          userId: 'user-1',
          permission: 'EDITOR',
          grantedById: 'owner-1',
        }),
        include: { user: true, grantedBy: true },
      });
      expect(result).toEqual(upserted);
    });
  });
});
