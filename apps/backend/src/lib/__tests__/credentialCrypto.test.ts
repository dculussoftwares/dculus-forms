import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CredentialCryptoError,
  isSealed,
  openAutomationGraph,
  openCredential,
  openPluginConfig,
  sealAutomationGraph,
  sealCredential,
  sealPluginConfig,
} from '../credentialCrypto.js';
import { withCredentialEncryption } from '../credentialEncryptionExtension.js';

const KEY_ENV = 'CREDENTIAL_ENCRYPTION_KEY';

const webhookConfig = {
  type: 'webhook',
  url: 'https://example.com/hook',
  secret: 'hmac-secret',
  headers: { Authorization: 'Bearer abc', 'X-Trace': 'on' },
};

describe('credentialCrypto', () => {
  beforeEach(() => {
    process.env[KEY_ENV] = 'unit-test-key';
  });

  afterEach(() => {
    delete process.env[KEY_ENV];
  });

  it('round-trips a credential and never stores it in the clear', () => {
    const sealed = sealCredential('hmac-secret');
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain('hmac-secret');
    expect(openCredential(sealed)).toBe('hmac-secret');
  });

  it('uses a fresh IV per value and does not seal twice', () => {
    expect(sealCredential('same')).not.toBe(sealCredential('same'));
    const sealed = sealCredential('once');
    expect(sealCredential(sealed)).toBe(sealed);
  });

  it('is a no-op for writes when no key is configured, and reads legacy plaintext', () => {
    delete process.env[KEY_ENV];
    expect(sealCredential('plain')).toBe('plain');
    expect(openCredential('plain')).toBe('plain');
  });

  it('throws rather than returning ciphertext when the key is missing or wrong', () => {
    const sealed = sealCredential('hmac-secret');

    delete process.env[KEY_ENV];
    expect(() => openCredential(sealed)).toThrow(CredentialCryptoError);

    process.env[KEY_ENV] = 'a-different-key';
    expect(() => openCredential(sealed)).toThrow(CredentialCryptoError);
  });

  it('seals only credential fields of a plugin config', () => {
    const sealed = sealPluginConfig(webhookConfig) as typeof webhookConfig;

    expect(isSealed(sealed.secret)).toBe(true);
    expect(isSealed(sealed.headers.Authorization)).toBe(true);
    expect(sealed.url).toBe(webhookConfig.url);
    expect(sealed.type).toBe('webhook');
    expect(openPluginConfig(sealed)).toEqual(webhookConfig);
  });

  it('seals OAuth tokens but leaves the connected account readable', () => {
    const config = { googleToken: { accessToken: 'at', refreshToken: 'rt', email: 'a@example.com' } };
    const sealed = sealPluginConfig(config);

    expect(isSealed(sealed.googleToken.accessToken)).toBe(true);
    expect(isSealed(sealed.googleToken.refreshToken)).toBe(true);
    expect(sealed.googleToken.email).toBe('a@example.com');
    expect(openPluginConfig(sealed)).toEqual(config);
  });

  it('seals every action node of an automation graph', () => {
    const graph = {
      nodes: [
        { id: 't', type: 'trigger', data: { secret: 'untouched' } },
        { id: 'a', type: 'action', data: { config: webhookConfig } },
      ],
      edges: [],
    };
    const sealed = sealAutomationGraph(graph) as any;

    expect(sealed.nodes[0].data.secret).toBe('untouched');
    expect(isSealed(sealed.nodes[1].data.config.secret)).toBe(true);
    expect(openAutomationGraph(sealed)).toEqual(graph);
  });
});

describe('withCredentialEncryption (Prisma extension)', () => {
  beforeEach(() => {
    process.env[KEY_ENV] = 'unit-test-key';
  });

  afterEach(() => {
    delete process.env[KEY_ENV];
  });

  it('seals data on write and opens the returned row', async () => {
    let stored: any;
    const query = vi.fn(async (args: any) => {
      stored = args.data;
      return { id: 'p1', config: args.data.config };
    });

    const result: any = await withCredentialEncryption({
      model: 'FormPlugin',
      operation: 'create',
      args: { data: { id: 'p1', config: webhookConfig } },
      query,
    });

    expect(isSealed(stored.config.secret)).toBe(true);
    expect(result.config).toEqual(webhookConfig);
  });

  it('opens rows from list reads and nested automation relations', async () => {
    const sealedGraph = sealAutomationGraph({
      nodes: [{ id: 'a', type: 'action', data: { config: webhookConfig } }],
      edges: [],
    });

    const run: any = await withCredentialEncryption({
      model: 'AutomationRun',
      operation: 'findUnique',
      args: {},
      query: async () => ({ id: 'r1', graphSnapshot: sealedGraph, automation: { id: 'a1', graph: sealedGraph } }),
    });
    expect(run.graphSnapshot.nodes[0].data.config).toEqual(webhookConfig);
    expect(run.automation.graph.nodes[0].data.config).toEqual(webhookConfig);

    const plugins: any = await withCredentialEncryption({
      model: 'FormPlugin',
      operation: 'findMany',
      args: {},
      query: async () => [{ id: 'p1', config: sealPluginConfig(webhookConfig) }, null],
    });
    expect(plugins[0].config).toEqual(webhookConfig);
  });

  it('seals both branches of an upsert and leaves other models alone', async () => {
    const seen: any[] = [];
    await withCredentialEncryption({
      model: 'FormPlugin',
      operation: 'upsert',
      args: { create: { config: webhookConfig }, update: { config: webhookConfig } },
      query: async (args: any) => {
        seen.push(args);
        return null;
      },
    });
    expect(isSealed(seen[0].create.config.secret)).toBe(true);
    expect(isSealed(seen[0].update.config.secret)).toBe(true);

    const args = { data: { config: webhookConfig } };
    const query = vi.fn(async () => null);
    await withCredentialEncryption({ model: 'Form', operation: 'create', args, query });
    expect(query).toHaveBeenCalledWith(args);
  });
});
