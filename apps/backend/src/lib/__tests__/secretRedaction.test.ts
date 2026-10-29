import { describe, it, expect } from 'vitest';
import {
  SECRET_MASK,
  mergeMaskedConfig,
  mergeMaskedGraph,
  redactAutomationGraph,
  redactPluginConfig,
  redactRunOutput,
} from '../secretRedaction.js';

const webhookConfig = {
  type: 'webhook',
  url: 'https://example.com/hook',
  secret: 'hmac-secret',
  headers: { Authorization: 'Bearer abc', 'X-Trace': 'on' },
};

const sheetsConfig = {
  type: 'google-sheets',
  spreadsheetId: 'sheet-1',
  googleToken: { accessToken: 'ya29.access', refreshToken: '1//refresh', email: 'me@example.com', expiresAt: 123 },
};

describe('redactPluginConfig', () => {
  it('masks the webhook secret and header values but keeps what the UI needs', () => {
    const redacted = redactPluginConfig(webhookConfig) as any;
    expect(redacted.url).toBe(webhookConfig.url);
    expect(redacted.secret).toBe(SECRET_MASK);
    expect(redacted.hasSecret).toBe(true);
    expect(Object.keys(redacted.headers)).toEqual(['Authorization', 'X-Trace']);
    expect(Object.values(redacted.headers)).toEqual([SECRET_MASK, SECRET_MASK]);
    expect(JSON.stringify(redacted)).not.toContain('hmac-secret');
    expect(JSON.stringify(redacted)).not.toContain('Bearer abc');
  });

  it('reports hasSecret=false when none is configured', () => {
    expect((redactPluginConfig({ url: 'https://x.test', secret: '' }) as any).hasSecret).toBe(false);
  });

  it('masks OAuth tokens and exposes the connected account', () => {
    const redacted = redactPluginConfig(sheetsConfig) as any;
    expect(redacted.googleToken.accessToken).toBe(SECRET_MASK);
    expect(redacted.googleToken.refreshToken).toBe(SECRET_MASK);
    expect(redacted.googleToken.email).toBe('me@example.com');
    expect(redacted.connectedEmail).toBe('me@example.com');
    expect(redacted.spreadsheetId).toBe('sheet-1');
    expect(JSON.stringify(redacted)).not.toContain('ya29.access');
    expect(JSON.stringify(redacted)).not.toContain('1//refresh');

    const ms = redactPluginConfig({ microsoftToken: { accessToken: 'ms-a', refreshToken: 'ms-r' } }) as any;
    expect(ms.microsoftToken).toEqual({ accessToken: SECRET_MASK, refreshToken: SECRET_MASK });
  });

  it('does not mutate its input and tolerates non-objects', () => {
    const copy = JSON.parse(JSON.stringify(webhookConfig));
    redactPluginConfig(webhookConfig);
    expect(webhookConfig).toEqual(copy);
    expect(redactPluginConfig(null)).toBeNull();
    expect(redactPluginConfig('x')).toBe('x');
  });
});

describe('mergeMaskedConfig', () => {
  it('restores stored credentials the client sent back as the mask', () => {
    const roundTripped = redactPluginConfig({ ...webhookConfig });
    const merged = mergeMaskedConfig(webhookConfig, { ...(roundTripped as object), url: 'https://example.com/new' }) as any;
    expect(merged.url).toBe('https://example.com/new');
    expect(merged.secret).toBe('hmac-secret');
    expect(merged.headers).toEqual(webhookConfig.headers);
    expect(merged).not.toHaveProperty('hasSecret');
  });

  it('keeps a newly typed secret or header', () => {
    const merged = mergeMaskedConfig(webhookConfig, {
      ...webhookConfig,
      secret: 'rotated',
      headers: { Authorization: SECRET_MASK, 'X-New': 'v' },
    }) as any;
    expect(merged.secret).toBe('rotated');
    expect(merged.headers).toEqual({ Authorization: 'Bearer abc', 'X-New': 'v' });
  });

  it('drops headers removed by the client', () => {
    const merged = mergeMaskedConfig(webhookConfig, { ...webhookConfig, headers: { 'X-Trace': 'on' } }) as any;
    expect(merged.headers).toEqual({ 'X-Trace': 'on' });
  });

  it('never stores the mask when there is nothing to restore', () => {
    const merged = mergeMaskedConfig(undefined, { url: 'https://x.test', secret: SECRET_MASK, headers: { A: SECRET_MASK } }) as any;
    expect(merged).not.toHaveProperty('secret');
    expect(merged.headers).toEqual({});
    expect(JSON.stringify(merged)).not.toContain(SECRET_MASK);
  });

  it('restores OAuth tokens and strips the derived connectedEmail', () => {
    const merged = mergeMaskedConfig(sheetsConfig, redactPluginConfig(sheetsConfig)) as any;
    expect(merged.googleToken).toEqual(sheetsConfig.googleToken);
    expect(merged).not.toHaveProperty('connectedEmail');
  });

  it('drops a masked token that has no stored counterpart', () => {
    const merged = mergeMaskedConfig({}, redactPluginConfig(sheetsConfig)) as any;
    expect(merged).not.toHaveProperty('googleToken');
  });

  it('accepts fresh tokens from a new OAuth connection', () => {
    const fresh = { accessToken: 'new-a', refreshToken: 'new-r', email: 'new@example.com' };
    const merged = mergeMaskedConfig(sheetsConfig, { ...sheetsConfig, googleToken: fresh }) as any;
    expect(merged.googleToken).toEqual(fresh);
  });
});

describe('automation graphs', () => {
  const graph = {
    nodes: [
      { id: 't', type: 'trigger', data: { label: 'Trigger' } },
      { id: 'a1', type: 'action', data: { actionType: 'webhook', config: webhookConfig } },
      { id: 'a2', type: 'action', data: { actionType: 'google-sheets', config: sheetsConfig } },
    ],
    edges: [],
  };

  it('masks credentials in action node configs only', () => {
    const redacted = redactAutomationGraph(graph) as any;
    expect(redacted.nodes[0]).toEqual(graph.nodes[0]);
    expect(redacted.nodes[1].data.config.secret).toBe(SECRET_MASK);
    expect(redacted.nodes[2].data.config.googleToken.accessToken).toBe(SECRET_MASK);
    const json = JSON.stringify(redacted);
    for (const secret of ['hmac-secret', 'Bearer abc', 'ya29.access', '1//refresh']) {
      expect(json).not.toContain(secret);
    }
  });

  it('restores credentials by node id when a masked graph is saved back', () => {
    const merged = mergeMaskedGraph(graph, redactAutomationGraph(graph)) as any;
    expect(merged.nodes[1].data.config.secret).toBe('hmac-secret');
    expect(merged.nodes[1].data.config.headers).toEqual(webhookConfig.headers);
    expect(merged.nodes[2].data.config.googleToken).toEqual(sheetsConfig.googleToken);
  });

  it('never stores the mask for a node that is new to the graph', () => {
    const incoming = {
      nodes: [{ id: 'new', type: 'action', data: { actionType: 'webhook', config: { url: 'https://x.test', secret: SECRET_MASK } } }],
      edges: [],
    };
    const merged = mergeMaskedGraph(graph, incoming) as any;
    expect(merged.nodes[0].data.config).not.toHaveProperty('secret');
  });

  it('passes through values that are not graphs', () => {
    expect(redactAutomationGraph(null)).toBeNull();
    expect(mergeMaskedGraph(graph, { foo: 1 })).toEqual({ foo: 1 });
  });
});

describe('redactRunOutput', () => {
  const output = {
    success: true,
    statusCode: 200,
    responseBody: { leaked: 'internal data' },
    responseExcerpt: 'short',
    nested: [{ responseBody: 'x', keep: 1 }],
  };

  it('always drops full receiver bodies stored by older runs', () => {
    const result = redactRunOutput(output, true) as any;
    expect(result).not.toHaveProperty('responseBody');
    expect(result.nested[0]).toEqual({ keep: 1 });
    expect(result.responseExcerpt).toBe('short');
  });

  it('drops the excerpt too for readers below EDITOR', () => {
    const result = redactRunOutput(output, false) as any;
    expect(result).not.toHaveProperty('responseExcerpt');
    expect(result.statusCode).toBe(200);
  });

  it('passes through primitives and null', () => {
    expect(redactRunOutput(null, false)).toBeNull();
    expect(redactRunOutput('x', false)).toBe('x');
  });
});
