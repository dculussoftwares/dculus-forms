/**
 * Public projection of plugin / automation configuration.
 *
 * Plugin and action configs hold credentials inline (webhook HMAC secret, receiver auth headers,
 * Google / Microsoft OAuth tokens). Callers who are not allowed to manage the integration get the
 * configuration with every credential masked; the shape is preserved so read-only UI keeps
 * rendering, and booleans (`hasSecret`, `connectedEmail`) say what is configured.
 *
 * The inverse, {@link mergeMaskedConfig}, treats a mask coming back on save as "unchanged", so a
 * client that round-trips a masked config can never overwrite a stored secret with the mask.
 *
 * Follow-up (not done here): encrypt these values at rest and stop copying them into
 * `AutomationRun.graphSnapshot`.
 */

export const SECRET_MASK = '••••••••';

type ConfigRecord = Record<string, any>;

const TOKEN_KEYS = ['googleToken', 'microsoftToken'] as const;
const SECRET_FIELD_PATTERN = /(secret|password|passphrase|api[-_]?key|private[-_]?key|authorization|credential)/i;
const TOKEN_SECRET_FIELDS = ['accessToken', 'refreshToken'] as const;
/** Derived flags added by redaction; never persisted. */
const DERIVED_KEYS = ['hasSecret', 'connectedEmail'] as const;

const isRecord = (value: unknown): value is ConfigRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasValue = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

const redactToken = (token: unknown): unknown => {
  if (!isRecord(token)) return token;
  const redacted: ConfigRecord = { ...token };
  for (const field of TOKEN_SECRET_FIELDS) {
    if (hasValue(redacted[field])) redacted[field] = SECRET_MASK;
  }
  return redacted;
};

export const redactPluginConfig = <T>(config: T): T => {
  if (!isRecord(config)) return config;

  const redacted: ConfigRecord = { ...config };

  for (const key of Object.keys(redacted)) {
    const value = redacted[key];
    if ((TOKEN_KEYS as readonly string[]).includes(key)) {
      redacted[key] = redactToken(value);
      if (isRecord(value) && typeof value.email === 'string') redacted.connectedEmail = value.email;
    } else if (key === 'headers' && isRecord(value)) {
      redacted.headers = Object.fromEntries(
        Object.entries(value).map(([name, headerValue]) => [name, hasValue(headerValue) ? SECRET_MASK : headerValue])
      );
    } else if (SECRET_FIELD_PATTERN.test(key) && typeof value === 'string' && value !== '') {
      redacted[key] = SECRET_MASK;
    }
  }

  if ('secret' in config) redacted.hasSecret = hasValue(config.secret);

  return redacted as T;
};

const mergeToken = (existing: unknown, incoming: unknown): unknown => {
  if (!isRecord(incoming)) return incoming;
  const previous = isRecord(existing) ? existing : undefined;
  const merged: ConfigRecord = { ...incoming };
  delete merged.connectedEmail;

  let unresolved = false;
  for (const field of TOKEN_SECRET_FIELDS) {
    if (merged[field] !== SECRET_MASK) continue;
    if (previous && hasValue(previous[field])) {
      merged[field] = previous[field];
    } else {
      delete merged[field];
      unresolved = true;
    }
  }

  // A token whose credentials could not be restored is unusable; drop it instead of storing a mask.
  return unresolved ? undefined : merged;
};

/**
 * Applies an incoming config over the stored one, restoring any credential the client sent back as
 * the mask (or omitted behind a derived flag) from `existing`.
 */
export const mergeMaskedConfig = <T>(existing: unknown, incoming: T): T => {
  if (!isRecord(incoming)) return incoming;
  const previous = isRecord(existing) ? existing : {};
  const merged: ConfigRecord = { ...incoming };

  for (const key of DERIVED_KEYS) delete merged[key];

  for (const key of Object.keys(merged)) {
    const value = merged[key];
    if ((TOKEN_KEYS as readonly string[]).includes(key)) {
      const token = mergeToken(previous[key], value);
      if (token === undefined) delete merged[key];
      else merged[key] = token;
    } else if (key === 'headers' && isRecord(value)) {
      const headers: ConfigRecord = {};
      const previousHeaders = isRecord(previous.headers) ? previous.headers : {};
      for (const [name, headerValue] of Object.entries(value)) {
        if (headerValue !== SECRET_MASK) headers[name] = headerValue;
        else if (hasValue(previousHeaders[name])) headers[name] = previousHeaders[name];
      }
      merged.headers = headers;
    } else if (value === SECRET_MASK) {
      if (hasValue(previous[key])) merged[key] = previous[key];
      else delete merged[key];
    }
  }

  return merged as T;
};

interface GraphWithNodes {
  nodes?: Array<{ id?: string; type?: string; data?: ConfigRecord }>;
}

const mapActionConfigs = <T>(graph: T, transform: (node: { id?: string }, config: unknown) => unknown): T => {
  const nodes = (graph as GraphWithNodes | null)?.nodes;
  if (!Array.isArray(nodes)) return graph;

  return {
    ...(graph as object),
    nodes: nodes.map((node) => {
      if (node?.type !== 'action' || !isRecord(node.data) || node.data.config === undefined) return node;
      return { ...node, data: { ...node.data, config: transform(node, node.data.config) } };
    }),
  } as T;
};

export const redactAutomationGraph = <T>(graph: T): T =>
  mapActionConfigs(graph, (_node, config) => redactPluginConfig(config));

/** Graph counterpart of {@link mergeMaskedConfig}: matches nodes by id against the stored graph. */
export const mergeMaskedGraph = <T>(existingGraph: unknown, incomingGraph: T): T => {
  const existingNodes = (existingGraph as GraphWithNodes | null)?.nodes;
  return mapActionConfigs(incomingGraph, (node, config) => {
    const previous = Array.isArray(existingNodes) ? existingNodes.find((n) => n?.id === node.id) : undefined;
    return mergeMaskedConfig(previous?.data?.config, config);
  });
};

/**
 * Step output / run context as shown to a reader. Older runs stored the webhook receiver's full
 * response body under `responseBody`; it is dropped everywhere. `includeExcerpt` controls whether
 * the short `responseExcerpt` is kept (EDITOR and above only).
 */
export const redactRunOutput = (value: unknown, includeExcerpt: boolean): unknown => {
  if (Array.isArray(value)) return value.map((item) => redactRunOutput(item, includeExcerpt));
  if (!isRecord(value)) return value;

  const result: ConfigRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'responseBody') continue;
    if (key === 'responseExcerpt' && !includeExcerpt) continue;
    result[key] = redactRunOutput(entry, includeExcerpt);
  }
  return result;
};
