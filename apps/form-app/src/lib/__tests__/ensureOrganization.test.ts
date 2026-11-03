jest.mock('../auth-client', () => ({
  authClient: { getSession: jest.fn(), organization: { create: jest.fn() } },
  organization: { setActive: jest.fn() },
}));

import { authClient, organization } from '../auth-client';
import { ensureOrganization, workspaceSlugCandidates } from '../ensureOrganization';

const session = (activeOrganizationId: string | null = null) => ({
  data: { session: { activeOrganizationId } },
  error: null,
});

describe('workspaceSlugCandidates', () => {
  it('falls back to "workspace" when the name has no Latin letters', () => {
    expect(workspaceSlugCandidates('நதீஷ் அவர்களின் பணியிடம்')[0]).toBe('workspace');
  });

  it('adds distinct suffixes after the first attempt', () => {
    const [first, ...rest] = workspaceSlugCandidates("Ada's workspace", 4);
    expect(first).toBe('adas-workspace');
    expect(rest).toHaveLength(3);
    rest.forEach((s) => expect(s).toMatch(/^adas-workspace-[a-z0-9]+$/));
  });
});

describe('ensureOrganization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reuses an active organization', async () => {
    (authClient.getSession as jest.Mock).mockResolvedValue(session('org-1'));
    await expect(ensureOrganization('X')).resolves.toEqual({ organizationId: 'org-1', created: false });
    expect(authClient.organization.create).not.toHaveBeenCalled();
  });

  it('retries with a suffixed slug when the first one is taken', async () => {
    (authClient.getSession as jest.Mock).mockResolvedValue(session());
    (authClient.organization.create as jest.Mock)
      .mockResolvedValueOnce({ data: null, error: { code: 'ORGANIZATION_ALREADY_EXISTS' } })
      .mockResolvedValueOnce({ data: { id: 'org-2' } });

    await expect(ensureOrganization("Ada's workspace")).resolves.toEqual({ organizationId: 'org-2', created: true });
    const slugs = (authClient.organization.create as jest.Mock).mock.calls.map((c) => c[0].slug);
    expect(slugs[0]).toBe('adas-workspace');
    expect(slugs[1]).toMatch(/^adas-workspace-/);
    expect(organization.setActive).toHaveBeenCalledWith({ organizationId: 'org-2' });
  });

  it('gives up after every slug is taken', async () => {
    (authClient.getSession as jest.Mock).mockResolvedValue(session());
    (authClient.organization.create as jest.Mock).mockResolvedValue({ data: null, error: { code: 'ORGANIZATION_ALREADY_EXISTS' } });
    await expect(ensureOrganization('X')).resolves.toBeNull();
    expect(authClient.organization.create).toHaveBeenCalledTimes(4);
  });

  it('does not retry other errors', async () => {
    (authClient.getSession as jest.Mock).mockResolvedValue(session());
    (authClient.organization.create as jest.Mock).mockResolvedValue({ data: null, error: { code: 'INTERNAL_SERVER_ERROR' } });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(ensureOrganization('X')).resolves.toBeNull();
    expect(authClient.organization.create).toHaveBeenCalledTimes(1);
  });

  it('refuses a blank name', async () => {
    await expect(ensureOrganization('  ')).resolves.toBeNull();
    expect(authClient.getSession).not.toHaveBeenCalled();
  });

  it('returns null without a session', async () => {
    (authClient.getSession as jest.Mock).mockResolvedValue({ data: null, error: {} });
    await expect(ensureOrganization('X')).resolves.toBeNull();
  });
});
