import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '#prisma-client';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import type { FormSettings } from '@dculus/types';
import type { BetterAuthContext } from '../../middleware/better-auth-middleware.js';

vi.mock('../../repositories/index.js', () => ({
  responseDraftRepository: {
    findForRespondent: vi.fn(),
    create: vi.fn(),
    updateIfVersion: vi.fn(),
    deleteForRespondent: vi.fn(),
    deleteExpired: vi.fn(),
  },
}));
vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { responseDraftRepository } from '../../repositories/index.js';
import {
  canUseDrafts,
  clearDraftAfterSubmit,
  discardResponseDraft,
  getResponseDraft,
  requireDraftAccess,
  saveResponseDraft,
} from '../responseDraftService.js';

const repo = vi.mocked(responseDraftRepository);

const signedIn: BetterAuthContext = {
  user: { id: 'user-1', email: 'respondent@example.com' },
  session: {},
  isAuthenticated: true,
};
const anonymous: BetterAuthContext = { user: null, session: null, isAuthenticated: false };

const gatedSettings: FormSettings = { accessControl: { enabled: true, requireSignIn: true } };
const gatedForm = { id: 'form-1', isPublished: true, settings: gatedSettings };

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'draft-1',
  formId: 'form-1',
  userId: 'user-1',
  data: { name: 'Ada' },
  currentPageId: 'page-2',
  version: 3,
  startedAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-02T10:00:00Z'),
  expiresAt: new Date(Date.now() + 86_400_000),
  ...overrides,
});

const expectGraphQLCode = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (error: any) {
    expect(error.extensions?.code).toBe(code);
    return;
  }
  throw new Error(`Expected a GraphQL error with code ${code}`);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('canUseDrafts', () => {
  it('allows a signed-in respondent on a published, identity-gated form', () => {
    expect(canUseDrafts(gatedForm, signedIn)).toBe(true);
  });

  it('allows any signed-in caller on a form that does not require sign-in', () => {
    expect(canUseDrafts({ ...gatedForm, settings: {} }, signedIn)).toBe(true);
    expect(canUseDrafts({ ...gatedForm, settings: null }, signedIn)).toBe(true);
  });

  it('is off when the owner disabled save progress', () => {
    const settings = { ...gatedSettings, saveProgress: { enabled: false } };
    expect(canUseDrafts({ ...gatedForm, settings }, signedIn)).toBe(false);
  });

  it('is off when the caller is outside the domain allowlist', () => {
    const settings = { accessControl: { enabled: true, requireSignIn: true, allowedDomains: ['other.com'] } };
    expect(canUseDrafts({ ...gatedForm, settings }, signedIn)).toBe(false);
  });

  it('is off for unpublished forms and signed-out callers', () => {
    expect(canUseDrafts({ ...gatedForm, isPublished: false }, signedIn)).toBe(false);
    expect(canUseDrafts(gatedForm, anonymous)).toBe(false);
  });
});

describe('requireDraftAccess', () => {
  it('returns the caller id when every gate passes', () => {
    expect(requireDraftAccess(gatedForm, signedIn)).toBe('user-1');
  });

  it('rejects a missing or unpublished form', () => {
    expectGraphQLCode(() => requireDraftAccess(null, signedIn), GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
    expectGraphQLCode(
      () => requireDraftAccess({ ...gatedForm, isPublished: false }, signedIn),
      GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED
    );
  });

  it('requires sign-in', () => {
    expectGraphQLCode(() => requireDraftAccess(gatedForm, anonymous), GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED);
  });

  it('accepts a signed-in caller on a form that does not require sign-in', () => {
    expect(requireDraftAccess({ ...gatedForm, settings: {} }, signedIn)).toBe('user-1');
  });

  it('rejects forms whose owner turned save progress off', () => {
    const settings = { saveProgress: { enabled: false } };
    expectGraphQLCode(() => requireDraftAccess({ ...gatedForm, settings }, signedIn), GRAPHQL_ERROR_CODES.NO_ACCESS);
  });

  it('rejects callers outside the domain allowlist', () => {
    const settings = { accessControl: { enabled: true, requireSignIn: true, allowedDomains: ['other.com'] } };
    expectGraphQLCode(
      () => requireDraftAccess({ ...gatedForm, settings }, signedIn),
      GRAPHQL_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED
    );
  });

  it('rejects saves outside the form time window', () => {
    const settings: FormSettings = {
      ...gatedSettings,
      submissionLimits: { timeWindow: { enabled: true, endDate: '2000-01-01T00:00:00.000Z' } },
    };
    expect(() => requireDraftAccess({ ...gatedForm, settings }, signedIn)).toThrow();
  });
});

describe('getResponseDraft', () => {
  it('maps the stored row to the public view', async () => {
    repo.findForRespondent.mockResolvedValue(row() as any);
    await expect(getResponseDraft('form-1', 'user-1')).resolves.toEqual({
      data: { name: 'Ada' },
      currentPageId: 'page-2',
      version: 3,
      startedAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.000Z',
    });
  });

  it('hides and deletes expired drafts that the cleanup job has not purged yet', async () => {
    repo.findForRespondent.mockResolvedValue(row({ expiresAt: new Date(Date.now() - 1000) }) as any);
    await expect(getResponseDraft('form-1', 'user-1')).resolves.toBeNull();
    expect(repo.deleteForRespondent).toHaveBeenCalledWith('form-1', 'user-1');
  });
});

describe('saveResponseDraft', () => {
  const base = { formId: 'form-1', userId: 'user-1', data: { name: 'Ada' }, currentPageId: 'page-2' };

  it('creates the draft on a first save', async () => {
    repo.findForRespondent.mockResolvedValue(null);
    repo.create.mockResolvedValue(row({ version: 1 }) as any);

    const result = await saveResponseDraft({ ...base, baseVersion: null });

    expect(result.conflict).toBe(false);
    expect(result.draft?.version).toBe(1);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ formId: 'form-1', userId: 'user-1', currentPageId: 'page-2' })
    );
  });

  it('reports a conflict instead of overwriting a draft made on another device', async () => {
    repo.findForRespondent.mockResolvedValue(row() as any);

    const result = await saveResponseDraft({ ...base, baseVersion: null });

    expect(result).toEqual(expect.objectContaining({ conflict: true }));
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('reports a conflict when two first saves race on the unique key', async () => {
    repo.findForRespondent.mockResolvedValueOnce(null).mockResolvedValueOnce(row() as any);
    repo.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
    );

    const result = await saveResponseDraft({ ...base, baseVersion: null });

    expect(result.conflict).toBe(true);
    expect(result.draft?.version).toBe(3);
  });

  it('replaces an expired draft on a first save instead of reporting a conflict', async () => {
    repo.findForRespondent.mockResolvedValueOnce(row({ expiresAt: new Date(Date.now() - 1000) }) as any);
    repo.create.mockResolvedValue(row({ version: 1 }) as any);

    const result = await saveResponseDraft({ ...base, baseVersion: null });

    expect(repo.deleteForRespondent).toHaveBeenCalledWith('form-1', 'user-1');
    expect(result).toEqual(expect.objectContaining({ conflict: false }));
    expect(result.draft?.version).toBe(1);
  });

  it('updates when the client holds the current version', async () => {
    repo.updateIfVersion.mockResolvedValue(1);
    repo.findForRespondent.mockResolvedValue(row({ version: 4 }) as any);

    const result = await saveResponseDraft({ ...base, baseVersion: 3 });

    expect(repo.updateIfVersion).toHaveBeenCalledWith(
      'form-1',
      'user-1',
      3,
      expect.objectContaining({ data: { name: 'Ada' }, currentPageId: 'page-2' })
    );
    expect(result).toEqual(expect.objectContaining({ conflict: false }));
    expect(result.draft?.version).toBe(4);
  });

  it('reports a conflict when a newer save already landed', async () => {
    repo.updateIfVersion.mockResolvedValue(0);
    repo.findForRespondent.mockResolvedValue(row({ version: 5 }) as any);

    const result = await saveResponseDraft({ ...base, baseVersion: 3 });

    expect(result.conflict).toBe(true);
    expect(result.draft?.version).toBe(5);
  });

  it('never recreates a draft that was submitted or discarded elsewhere', async () => {
    repo.findForRespondent.mockResolvedValue(null);

    const result = await saveResponseDraft({ ...base, baseVersion: 3 });

    expect(result).toEqual({ draft: null, conflict: true });
    expect(repo.updateIfVersion).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('does not revive an expired draft from a stale version', async () => {
    repo.findForRespondent
      .mockResolvedValueOnce(row({ expiresAt: new Date(Date.now() - 1000) }) as any)
      .mockResolvedValueOnce(null);

    const result = await saveResponseDraft({ ...base, baseVersion: 3 });

    expect(repo.deleteForRespondent).toHaveBeenCalledWith('form-1', 'user-1');
    expect(result).toEqual({ draft: null, conflict: true });
    expect(repo.updateIfVersion).not.toHaveBeenCalled();
  });

  it('rejects non-object data and oversized payloads', async () => {
    await expect(saveResponseDraft({ ...base, data: ['a'] })).rejects.toMatchObject({
      extensions: { code: GRAPHQL_ERROR_CODES.BAD_USER_INPUT },
    });
    await expect(saveResponseDraft({ ...base, data: { long: 'x'.repeat(10_001) } })).rejects.toMatchObject({
      extensions: { code: GRAPHQL_ERROR_CODES.BAD_USER_INPUT },
    });
    const nested = { list: Array.from({ length: 600 }, () => 'x'.repeat(10_000)) };
    await expect(saveResponseDraft({ ...base, data: nested })).rejects.toMatchObject({
      extensions: { code: GRAPHQL_ERROR_CODES.BAD_USER_INPUT },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('discard and clear', () => {
  it('discardResponseDraft reports whether a draft existed', async () => {
    repo.deleteForRespondent.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await expect(discardResponseDraft('form-1', 'user-1')).resolves.toBe(true);
    await expect(discardResponseDraft('form-1', 'user-1')).resolves.toBe(false);
  });

  it('clearDraftAfterSubmit never throws', async () => {
    repo.deleteForRespondent.mockRejectedValue(new Error('db down'));
    await expect(clearDraftAfterSubmit('form-1', 'user-1')).resolves.toBeUndefined();
  });
});
