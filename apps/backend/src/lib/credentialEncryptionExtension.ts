import {
  openAutomationGraph,
  openPluginConfig,
  sealAutomationGraph,
  sealPluginConfig,
} from './credentialCrypto.js';

type Transform = <T>(value: T) => T;
type FieldTransforms = Record<string, Transform>;
type Row = Record<string, unknown>;

/**
 * Json columns that hold credentials, and how to read / write each one. Applying this at the
 * Prisma client means every caller — resolvers, the plugin executor, the automation engine —
 * works on plaintext and none of them can forget to encrypt.
 */
const SEAL: Record<string, FieldTransforms> = {
  formPlugin: { config: sealPluginConfig },
  automation: { graph: sealAutomationGraph, draftGraph: sealAutomationGraph },
  automationRun: { graphSnapshot: sealAutomationGraph },
};

const OPEN: Record<string, FieldTransforms> = {
  formPlugin: { config: openPluginConfig },
  automation: { graph: openAutomationGraph, draftGraph: openAutomationGraph },
  automationRun: { graphSnapshot: openAutomationGraph },
};

/** Relations that can be loaded alongside a row and carry credential columns of their own. */
const NESTED: Record<string, Record<string, string>> = {
  automationRun: { automation: 'automation' },
};

const isRow = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);

const applyToRow = (model: string, row: unknown, table: Record<string, FieldTransforms>): unknown => {
  if (!isRow(row)) return row;

  const next: Row = { ...row };
  for (const [field, transform] of Object.entries(table[model] ?? {})) {
    if (next[field] !== undefined && next[field] !== null && typeof next[field] === 'object') {
      next[field] = transform(next[field]);
    }
  }
  for (const [relation, relatedModel] of Object.entries(NESTED[model] ?? {})) {
    if (next[relation] !== undefined) next[relation] = applyToRow(relatedModel, next[relation], table);
  }
  return next;
};

const applyToResult = (model: string, result: unknown, table: Record<string, FieldTransforms>): unknown =>
  Array.isArray(result) ? result.map((row) => applyToRow(model, row, table)) : applyToRow(model, result, table);

const sealData = (model: string, data: unknown): unknown =>
  Array.isArray(data) ? data.map((row) => applyToRow(model, row, SEAL)) : applyToRow(model, data, SEAL);

interface OperationParams {
  model: string;
  operation: string;
  args: unknown;
  query: (args: any) => Promise<unknown>;
}

export const withCredentialEncryption = async ({ model, operation, args, query }: OperationParams) => {
  const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
  if (!SEAL[modelKey]) return query(args);

  const nextArgs: Row = { ...(args as Row) };
  if ('data' in nextArgs) nextArgs.data = sealData(modelKey, nextArgs.data);
  if (operation === 'upsert') {
    nextArgs.create = sealData(modelKey, nextArgs.create);
    nextArgs.update = sealData(modelKey, nextArgs.update);
  }

  return applyToResult(modelKey, await query(nextArgs), OPEN);
};

// A plain object is all `$extends` needs; avoiding Prisma.defineExtension keeps this module free of a
// runtime dependency on the generated client.
export const credentialEncryption = {
  name: 'credential-encryption',
  query: {
    $allModels: {
      $allOperations: (params: unknown) => withCredentialEncryption(params as OperationParams),
    },
  },
};
