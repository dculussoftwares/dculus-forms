/// <reference types="jest" />

const signOutMock = jest.fn();
const signInMock = jest.fn();
const signUpMock = jest.fn();
const useSessionMock = jest.fn();
const getSessionMock = jest.fn();
const organizationMock = jest.fn();

const createAuthClientMock = jest.fn((_config: unknown) => ({
  signOut: signOutMock,
  signIn: signInMock,
  signUp: signUpMock,
  useSession: useSessionMock,
  getSession: getSessionMock,
  organization: organizationMock,
}));

jest.mock('better-auth/react', () => ({
  createAuthClient: (config: unknown) => createAuthClientMock(config),
}));

const organizationClientMock = jest.fn(() => 'organization-plugin');

jest.mock('better-auth/client/plugins', () => ({
  organizationClient: () => organizationClientMock(),
}));

jest.mock('../config', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));

describe('auth-client', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    createAuthClientMock.mockClear();
    signOutMock.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const loadModule = async () => {
    return await import('../auth-client');
  };

  it('initializes the auth client with expected configuration', async () => {
    await loadModule();
    expect(createAuthClientMock).toHaveBeenCalledTimes(1);

    const config = createAuthClientMock.mock.calls[0]![0] as any;
    expect(config.baseURL).toBe('https://api.example.com');
    expect(config.plugins).toEqual(['organization-plugin']);
  });

  it('persists auth token and organization id on successful responses', async () => {
    const { authClient } = await loadModule();
    const config = createAuthClientMock.mock.calls[0]![0] as any;

    config.fetchOptions.onSuccess({
      response: {
        headers: new Headers({
          'set-auth-token': 'token-123',
        }),
      },
      data: {
        session: {
          activeOrganizationId: 'org-789',
        },
      },
    });

    expect(localStorage.getItem('bearer_token')).toBe('token-123');
    expect(localStorage.getItem('organization_id')).toBe('org-789');
    expect(authClient).toBeDefined();
  });

  it('skips persisting when token or organization id are absent', async () => {
    await loadModule();
    const config = createAuthClientMock.mock.calls[0]![0] as any;

    config.fetchOptions.onSuccess({
      response: {
        headers: new Headers(),
      },
      data: {
        session: {},
      },
    });

    expect(localStorage.getItem('bearer_token')).toBeNull();
    expect(localStorage.getItem('organization_id')).toBeNull();
  });

  it('removes persisted credentials when auth errors occur', async () => {
    await loadModule();
    localStorage.setItem('bearer_token', 'existing-token');
    localStorage.setItem('organization_id', 'existing-org');
    const config = createAuthClientMock.mock.calls[0]![0] as any;

    config.fetchOptions.onError({
      response: {
        status: 401,
      },
    });

    expect(localStorage.getItem('bearer_token')).toBeNull();
    expect(localStorage.getItem('organization_id')).toBeNull();
  });

  it('retains stored credentials for non-authentication errors', async () => {
    await loadModule();
    localStorage.setItem('bearer_token', 'existing-token');
    localStorage.setItem('organization_id', 'existing-org');
    const config = createAuthClientMock.mock.calls[0]![0] as any;

    config.fetchOptions.onError({
      response: {
        status: 500,
      },
    });

    expect(localStorage.getItem('bearer_token')).toBe('existing-token');
    expect(localStorage.getItem('organization_id')).toBe('existing-org');
  });

  it('provides a bearer token getter sourced from localStorage', async () => {
    await loadModule();
    const config = createAuthClientMock.mock.calls[0]![0] as any;

    localStorage.setItem('bearer_token', 'retrieved-token');
    expect(config.fetchOptions.auth.token()).toBe('retrieved-token');

    localStorage.removeItem('bearer_token');
    expect(config.fetchOptions.auth.token()).toBe('');
  });

  it('clears storage and delegates to the underlying signOut implementation', async () => {
    const { signOut } = await loadModule();

    localStorage.setItem('bearer_token', 'token');
    localStorage.setItem('organization_id', 'org');

    await signOut({ redirect: false });

    expect(localStorage.getItem('bearer_token')).toBeNull();
    expect(localStorage.getItem('organization_id')).toBeNull();
    expect(signOutMock).toHaveBeenCalledWith({ redirect: false });
  });

  it('re-exports auth helpers from the underlying auth client', async () => {
    const module = await loadModule();
    expect(module.signIn).toBe(signInMock);
    expect(module.signUp).toBe(signUpMock);
    expect(module.useSession).toBe(useSessionMock);
    expect(module.getSession).toBe(getSessionMock);
    expect(module.organization).toBe(organizationMock);
  });
});
