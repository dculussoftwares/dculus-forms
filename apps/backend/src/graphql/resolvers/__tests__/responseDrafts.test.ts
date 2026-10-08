import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/formService.js');
vi.mock('../../../services/responseDraftService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/responseDraftService.js')>();
  return {
    ...actual,
    getResponseDraft: vi.fn(),
    saveResponseDraft: vi.fn(),
    discardResponseDraft: vi.fn(),
  };
});

import * as formService from '../../../services/formService.js';
import * as draftService from '../../../services/responseDraftService.js';
import { responseDraftsResolvers } from '../responseDrafts.js';

const signedIn = {
  auth: { user: { id: 'user-1', email: 'respondent@example.com' }, session: {}, isAuthenticated: true },
};
const gatedForm = {
  id: 'form-1',
  isPublished: true,
  settings: { accessControl: { enabled: true, requireSignIn: true } },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Form.myDraft', () => {
  it('returns the caller own draft on a gated form', async () => {
    const draft = { data: {}, currentPageId: null, version: 1, startedAt: 'a', updatedAt: 'b' };
    vi.mocked(draftService.getResponseDraft).mockResolvedValue(draft);

    const result = await responseDraftsResolvers.Form.myDraft(gatedForm, {}, signedIn as any);

    expect(result).toBe(draft);
    expect(draftService.getResponseDraft).toHaveBeenCalledWith('form-1', 'user-1');
  });

  it('parses settings stored as a JSON string', async () => {
    vi.mocked(draftService.getResponseDraft).mockResolvedValue(null);
    await responseDraftsResolvers.Form.myDraft(
      { ...gatedForm, settings: JSON.stringify(gatedForm.settings) },
      {},
      signedIn as any
    );
    expect(draftService.getResponseDraft).toHaveBeenCalled();
  });

  it('looks up the draft on a form that does not require sign-in', async () => {
    vi.mocked(draftService.getResponseDraft).mockResolvedValue({ version: 1 } as any);

    const result = await responseDraftsResolvers.Form.myDraft({ ...gatedForm, settings: {} }, {}, signedIn as any);

    expect(result).toEqual({ version: 1 });
  });

  it('returns null without a lookup when the owner turned save progress off', async () => {
    const settings = { saveProgress: { enabled: false } };
    const result = await responseDraftsResolvers.Form.myDraft({ ...gatedForm, settings }, {}, signedIn as any);

    expect(result).toBeNull();
    expect(draftService.getResponseDraft).not.toHaveBeenCalled();
  });
});

describe('Mutation.saveResponseDraft', () => {
  it('saves under the session user id, never a client-supplied one', async () => {
    vi.mocked(formService.getFormById).mockResolvedValue(gatedForm as any);
    vi.mocked(draftService.saveResponseDraft).mockResolvedValue({ draft: {} as any, conflict: false });

    await responseDraftsResolvers.Mutation.saveResponseDraft(
      {},
      { input: { formId: 'form-1', data: { a: 1 }, currentPageId: 'p1', baseVersion: 2 } },
      signedIn as any
    );

    expect(draftService.saveResponseDraft).toHaveBeenCalledWith({
      formId: 'form-1',
      userId: 'user-1',
      data: { a: 1 },
      currentPageId: 'p1',
      baseVersion: 2,
    });
  });

  it('rejects a signed-out caller before touching storage', async () => {
    vi.mocked(formService.getFormById).mockResolvedValue(gatedForm as any);

    await expect(
      responseDraftsResolvers.Mutation.saveResponseDraft(
        {},
        { input: { formId: 'form-1', data: {} } },
        { auth: { user: null, session: null, isAuthenticated: false } } as any
      )
    ).rejects.toMatchObject({ extensions: { code: 'SIGN_IN_REQUIRED' } });
    expect(draftService.saveResponseDraft).not.toHaveBeenCalled();
  });
});

describe('Mutation.discardResponseDraft', () => {
  it('discards the caller own draft', async () => {
    vi.mocked(formService.getFormById).mockResolvedValue(gatedForm as any);
    vi.mocked(draftService.discardResponseDraft).mockResolvedValue(true);

    const result = await responseDraftsResolvers.Mutation.discardResponseDraft({}, { formId: 'form-1' }, signedIn as any);

    expect(result).toBe(true);
    expect(draftService.discardResponseDraft).toHaveBeenCalledWith('form-1', 'user-1');
  });
});
