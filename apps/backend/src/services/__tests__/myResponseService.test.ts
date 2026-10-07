import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { DEFAULT_QUIZ_SETTINGS, type FormSettings } from '@dculus/types';
import type { BetterAuthContext } from '../../middleware/better-auth-middleware.js';

vi.mock('../../repositories/index.js', () => ({
  responseRepository: { findFirst: vi.fn() },
}));
vi.mock('../hocuspocus.js', () => ({ getFormSchemaFromHocuspocus: vi.fn() }));
vi.mock('../responseService.js', () => ({
  respondentResponsesWhere: (formId: string, respondentUserId: string) => ({ formId, respondentUserId }),
  updateResponse: vi.fn(),
}));
vi.mock('../../lib/conditionalStrip.js', () => ({
  stripConditionallyHiddenValues: vi.fn((_schema: unknown, data: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(data).filter(([fieldId]) => fieldId !== 'hidden'))
  ),
}));

import { responseRepository } from '../../repositories/index.js';
import { getFormSchemaFromHocuspocus } from '../hocuspocus.js';
import { updateResponse } from '../responseService.js';
import { editMyResponse, getMyResponse } from '../myResponseService.js';

const signedIn: BetterAuthContext = {
  user: { id: 'user-1', email: 'respondent@example.com' },
  session: {},
  isAuthenticated: true,
};
const anonymous: BetterAuthContext = { user: null, session: null, isAuthenticated: false };

const gated: FormSettings = { accessControl: { enabled: true, requireSignIn: true } };
const editable: FormSettings = { ...gated, allowRespondentEdit: true };
const form = (settings: FormSettings = editable) => ({
  id: 'form-1',
  isPublished: true,
  organizationId: 'org-1',
  settings,
  formSchema: { pages: [] },
});

const stored = {
  id: 'response-1',
  formId: 'form-1',
  data: { name: 'Ada' },
  submittedAt: new Date('2026-10-01T10:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(responseRepository.findFirst).mockResolvedValue(stored as any);
  vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue({ pages: [] } as any);
  vi.mocked(updateResponse).mockImplementation(async (id, data) => ({ ...stored, id, data }) as any);
});

describe('getMyResponse', () => {
  it("returns the caller's latest response with its edit permission", async () => {
    await expect(getMyResponse(form(), signedIn)).resolves.toEqual({
      id: 'response-1',
      data: { name: 'Ada' },
      submittedAt: '2026-10-01T10:00:00.000Z',
      canEdit: true,
    });
    expect(responseRepository.findFirst).toHaveBeenCalledWith({
      where: { formId: 'form-1', respondentUserId: 'user-1' },
      orderBy: { submittedAt: 'desc' },
    });
  });

  it('reports canEdit false when the form does not allow edits', async () => {
    await expect(getMyResponse(form(gated), signedIn)).resolves.toMatchObject({ canEdit: false });
  });

  it('reports canEdit false once the time window has closed, while still returning the response', async () => {
    const closedWindow: FormSettings = {
      ...editable,
      submissionLimits: { timeWindow: { enabled: true, endDate: new Date(Date.now() - 60_000).toISOString() } },
    };
    await expect(getMyResponse(form(closedWindow), signedIn)).resolves.toMatchObject({
      id: 'response-1',
      canEdit: false,
    });
  });

  it('is null without a response, on anonymous forms, and for signed-out or rejected callers', async () => {
    vi.mocked(responseRepository.findFirst).mockResolvedValueOnce(null);
    await expect(getMyResponse(form(), signedIn)).resolves.toBeNull();

    await expect(getMyResponse(form({}), signedIn)).resolves.toBeNull();
    await expect(getMyResponse(form(), anonymous)).resolves.toBeNull();
    const domainLocked = { ...editable, accessControl: { enabled: true, requireSignIn: true, allowedDomains: ['other.com'] } };
    await expect(getMyResponse(form(domainLocked), signedIn)).resolves.toBeNull();
    expect(responseRepository.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe('editMyResponse', () => {
  const edit = (overrides: Partial<Parameters<typeof editMyResponse>[0]> = {}) =>
    editMyResponse({ form: form(), auth: signedIn, data: { name: 'Grace' }, ...overrides });

  it('records the change as a RESPONDENT edit on the latest response', async () => {
    await expect(edit({ ipAddress: '1.2.3.4', userAgent: 'test' })).resolves.toMatchObject({
      id: 'response-1',
      data: { name: 'Grace' },
      canEdit: true,
    });
    expect(updateResponse).toHaveBeenCalledWith('response-1', { name: 'Grace' }, {
      userId: 'user-1',
      ipAddress: '1.2.3.4',
      userAgent: 'test',
      organizationId: 'org-1',
      editType: 'RESPONDENT',
    });
  });

  it('keeps stored answers to fields removed since submission', async () => {
    vi.mocked(responseRepository.findFirst).mockResolvedValue({ ...stored, data: { name: 'Ada', retired: 'old' } } as any);
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue({
      pages: [
        {
          id: 'page-1',
          title: 'Page 1',
          order: 0,
          fields: [{ id: 'name', type: 'text_input_field', label: 'Name' }],
        },
      ],
    } as any);

    await edit({ data: { name: 'Grace' } });

    expect(updateResponse).toHaveBeenCalledWith(
      'response-1',
      { retired: 'old', name: 'Grace' },
      expect.anything()
    );
  });

  it('keeps only the submitted answers when the live schema cannot be read', async () => {
    vi.mocked(responseRepository.findFirst).mockResolvedValue({ ...stored, data: { name: 'Ada', retired: 'old' } } as any);
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue({ pages: 'not-a-list' } as any);

    await edit({ data: { name: 'Grace' } });

    expect(updateResponse).toHaveBeenCalledWith('response-1', { name: 'Grace' }, expect.anything());
  });

  it('drops answers the form rules hide', async () => {
    await edit({ data: { name: 'Grace', hidden: 'x' } });
    expect(updateResponse).toHaveBeenCalledWith('response-1', { name: 'Grace' }, expect.anything());
  });

  it('rejects when edits are off, including on quiz forms', async () => {
    await expect(edit({ form: form(gated) })).rejects.toMatchObject({
      extensions: { code: GRAPHQL_ERROR_CODES.NO_ACCESS },
    });
    await expect(
      edit({ form: form({ ...editable, quiz: { ...DEFAULT_QUIZ_SETTINGS, enabled: true } }) })
    ).rejects.toMatchObject({ extensions: { code: GRAPHQL_ERROR_CODES.NO_ACCESS } });
    expect(updateResponse).not.toHaveBeenCalled();
  });

  it('runs the respondent gates', async () => {
    await expect(edit({ form: null })).rejects.toMatchObject({
      extensions: { code: GRAPHQL_ERROR_CODES.FORM_NOT_FOUND },
    });
    await expect(edit({ auth: anonymous })).rejects.toMatchObject({
      extensions: { code: GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED },
    });
    const closed = { ...editable, submissionLimits: { timeWindow: { enabled: true, endDate: '2000-01-01' } } };
    await expect(edit({ form: form(closed) })).rejects.toBeDefined();
    expect(updateResponse).not.toHaveBeenCalled();
  });

  it('rejects bad payloads and callers without a response', async () => {
    await expect(edit({ data: ['a'] })).rejects.toMatchObject({
      extensions: { code: GRAPHQL_ERROR_CODES.BAD_USER_INPUT },
    });
    await expect(edit({ data: { long: 'x'.repeat(10_001) } })).rejects.toBeDefined();

    vi.mocked(responseRepository.findFirst).mockResolvedValueOnce(null);
    await expect(edit()).rejects.toMatchObject({
      extensions: { code: GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND },
    });
    expect(updateResponse).not.toHaveBeenCalled();
  });
});
