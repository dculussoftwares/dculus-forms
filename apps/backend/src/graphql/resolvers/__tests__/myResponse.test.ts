import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/formService.js');
vi.mock('../../../services/myResponseService.js');

import * as formService from '../../../services/formService.js';
import * as myResponseService from '../../../services/myResponseService.js';
import { myResponseResolvers } from '../myResponse.js';

const context = {
  auth: { user: { id: 'user-1', email: 'respondent@example.com' }, session: {}, isAuthenticated: true },
  req: { ip: '1.2.3.4', headers: { 'user-agent': 'test-agent' } },
};
const settings = { accessControl: { enabled: true, requireSignIn: true }, allowRespondentEdit: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Form.myResponse', () => {
  it('parses stored settings JSON before handing the form to the service', async () => {
    vi.mocked(myResponseService.getMyResponse).mockResolvedValue(null);

    await myResponseResolvers.Form.myResponse(
      { id: 'form-1', isPublished: true, settings: JSON.stringify(settings) },
      {},
      context as any
    );

    expect(myResponseService.getMyResponse).toHaveBeenCalledWith(
      { id: 'form-1', isPublished: true, settings },
      context.auth
    );
  });
});

describe('Mutation.editMyResponse', () => {
  it('loads the form and passes the request metadata through', async () => {
    const form = { id: 'form-1', isPublished: true, organizationId: 'org-1', settings };
    vi.mocked(formService.getFormById).mockResolvedValue(form as any);
    vi.mocked(myResponseService.editMyResponse).mockResolvedValue({
      id: 'response-1',
      data: { name: 'Grace' },
      submittedAt: '2026-10-01T10:00:00.000Z',
      canEdit: true,
    });

    await myResponseResolvers.Mutation.editMyResponse(
      {},
      { input: { formId: 'form-1', data: { name: 'Grace' } } },
      context as any
    );

    expect(formService.getFormById).toHaveBeenCalledWith('form-1');
    expect(myResponseService.editMyResponse).toHaveBeenCalledWith({
      form,
      auth: context.auth,
      data: { name: 'Grace' },
      ipAddress: '1.2.3.4',
      userAgent: 'test-agent',
    });
  });
});
