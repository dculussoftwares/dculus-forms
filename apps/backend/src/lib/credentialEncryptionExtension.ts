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
  form: { plugins: 'formPlugin', automations: 'automation' },
  automation: { runs: 'automationRun' },
  automationRun: { automation: 'automation' },
};

/** Relation names that hold credential rows; writing through them would bypass sealing. */
const NESTED_WRITE_GUARD: Record<string, string[]> = {
  form: ['plugins', 'automations'],
  automation: ['runs'],
  automationRun: ['automation'],
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
    const related = next[relation];
    if (related !== undefined) next[relation] = applyToResult(relatedModel, related, table);
  }
  return next;
};

const applyToResult = (model: string, result: unknown, table: Record<string, FieldTransforms>): unknown =>
  Array.isArray(result) ? result.map((row) => applyToRow(model, row, table)) : applyToRow(model, result, table);

const sealData = (model: string, data: unknown): unknown =>
  Array.isArray(data) ? data.map((row) => applyToRow(model, row, SEAL)) : applyToRow(model, data, SEAL);

/** Nested operations that only link or unlink existing rows and never carry credential data. */
const LINK_ONLY_OPERATIONS = new Set(['connect', 'disconnect', 'set', 'delete', 'deleteMany']);

const assertNoNestedCredentialWrites = (model: string, args: Row) => {
  const payloads = [args.data, args.create, args.update].flat().filter(isRow);
  for (const relation of NESTED_WRITE_GUARD[model] ?? []) {
    const writesRows = (payload: Row) => {
      const value = payload[relation];
      return isRow(value) && Object.keys(value).some((key) => !LINK_ONLY_OPERATIONS.has(key));
    };
    if (payloads.some(writesRows)) {
      throw new Error(`Writing ${model}.${relation} through a nested write would bypass credential encryption; write the related model directly`);
    }
  }
};

interface OperationParams {
  model: string;
  operation: string;
  args: unknown;
  query: (args: any) => Promise<unknown>;
}

export const withCredentialEncryption = async ({ model, operation, args, query }: OperationParams) => {
  const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
  if (!SEAL[modelKey] && !NESTED[modelKey]) return query(args);

  const nextArgs: Row = { ...(args as Row) };
  assertNoNestedCredentialWrites(modelKey, nextArgs);
  if (!SEAL[modelKey]) return applyToResult(modelKey, await query(nextArgs), OPEN);
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
