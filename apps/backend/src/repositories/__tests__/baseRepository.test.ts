import { describe, it, expect, vi } from 'vitest';

const defaultPrismaMock = { model: {} } as any;

vi.mock('../../lib/prisma.js', () => ({
  prisma: defaultPrismaMock,
}));

const loadModule = async () => import('../baseRepository.js');

describe('baseRepository helpers', () => {
  it('resolvePrisma falls back to shared prisma instance', async () => {
    const { resolvePrisma } = await loadModule();

    expect(resolvePrisma()).toBe(defaultPrismaMock);
  });

  it('resolvePrisma respects scoped prisma context', async () => {
    const { resolvePrisma } = await loadModule();
    const scopedPrisma = { tx: vi.fn() } as any;

    expect(resolvePrisma({ prisma: scopedPrisma })).toBe(scopedPrisma);
  });

  it('createRepository wires resolved prisma into delegate factory', async () => {
    const { createRepository } = await loadModule();
    const delegate = { create: vi.fn() };
    const factory = vi.fn().mockReturnValue(delegate);

    const result = createRepository(factory);

    expect(factory).toHaveBeenCalledWith(defaultPrismaMock);
    expect(result).toBe(delegate);
  });

  it('createRepository can target a provided prisma client', async () => {
    const { createRepository } = await loadModule();
    const scopedPrisma = { scoped: true } as any;
    const factory = vi.fn().mockReturnValue({} as any);

    createRepository(factory, { prisma: scopedPrisma });

    expect(factory).toHaveBeenCalledWith(scopedPrisma);
  });

  it('withPrisma returns repository context wrapper', async () => {
    const { withPrisma } = await loadModule();
    const scopedPrisma = { some: 'client' } as any;

    expect(withPrisma(scopedPrisma)).toEqual({ prisma: scopedPrisma });
  });
});
