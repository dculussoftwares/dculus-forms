/// <reference types="jest" />

let capturedContext: any;
let concatenatedLink: unknown;

const createHttpLinkMock = jest.fn((options?: unknown) => ({
  type: 'http-link',
  options,
}));
const inMemoryCacheMock = jest.fn((options?: unknown) => ({
  type: 'cache',
  options,
}));
const concatMock = jest.fn((link: unknown) => {
  concatenatedLink = link;
  return 'auth-http-link';
});

const ApolloClientConstructor = jest.fn((config: any) => ({
  ...config,
  __client: true,
}));
const InMemoryCacheConstructor = jest.fn(function (this: any, options?: unknown) {
  const cache = inMemoryCacheMock(options);
  Object.assign(this, cache);
  return cache;
});

jest.mock('@apollo/client', () => ({
  ApolloClient: ApolloClientConstructor,
  InMemoryCache: InMemoryCacheConstructor,
  createHttpLink: (options: any) => createHttpLinkMock(options),
}));

jest.mock('@apollo/client/link/context', () => ({
  setContext: (callback: any) => {
    capturedContext = callback;
    return {
      concat: (link: unknown) => concatMock(link),
    };
  },
}));

jest.mock('../config', () => ({
  getGraphQLUrl: () => 'https://api.example.com/graphql',
}));

describe('apollo-client', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    createHttpLinkMock.mockClear();
    inMemoryCacheMock.mockClear();
    (jest.requireMock('@apollo/client') as any).ApolloClient.mockClear();
    concatMock.mockClear();
    concatenatedLink = undefined;
    capturedContext = undefined;
  });

  const loadModule = async () => {
    return await import('../apollo-client');
  };

  it('configures ApolloClient with auth link, cache, and defaults', async () => {
    const module = await loadModule();
    const apolloClientMock = ApolloClientConstructor;

    expect(createHttpLinkMock).toHaveBeenCalledWith({
      uri: 'https://api.example.com/graphql',
    });
    expect(inMemoryCacheMock).toHaveBeenCalledTimes(1);
    expect(concatMock).toHaveBeenCalledWith({
      type: 'http-link',
      options: { uri: 'https://api.example.com/graphql' },
    });
    expect(concatenatedLink).toEqual({
      type: 'http-link',
      options: { uri: 'https://api.example.com/graphql' },
    });

    expect(apolloClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        link: 'auth-http-link',
        cache: { type: 'cache' },
        credentials: 'include',
      })
    );

    const config = apolloClientMock.mock.calls[0]![0];
    expect(config.defaultOptions.watchQuery.errorPolicy).toBe('all');
    expect(config.defaultOptions.query.errorPolicy).toBe('all');
    expect(module.client).toMatchObject({ __client: true });
  });

  it('adds authorization header when a bearer token is present', async () => {
    await loadModule();
    const existingHeaders = { existing: 'header' };

    localStorage.setItem('bearer_token', 'token-xyz');
    const result = capturedContext({}, { headers: existingHeaders });

    expect(result.headers).toEqual({
      existing: 'header',
      authorization: 'Bearer token-xyz',
    });
  });

  it('passes through headers unchanged when no bearer token exists', async () => {
    await loadModule();
    const existingHeaders = { existing: 'header' };

    localStorage.removeItem('bearer_token');
    const result = capturedContext({}, { headers: existingHeaders });

    expect(result.headers).toEqual(existingHeaders);
  });
});
