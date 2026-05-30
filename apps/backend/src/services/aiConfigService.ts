import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// Model IDs must match the deployment name in Terraform (ai.tf).
// The Foundry /v1/ endpoint routes by the name in the request body,
// which must match an existing deployment on the resource.
export const SUPPORTED_MODELS = [
  // OpenAI models
  { id: 'gpt-4o',                      label: 'GPT-4o' },
  { id: 'gpt-4o-mini',                 label: 'GPT-4o Mini' },
  { id: 'gpt-4.1',                     label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini',                label: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano',                label: 'GPT-4.1 Nano' },
  // Non-OpenAI models (deployed via Terraform)
  { id: 'Phi-4',                       label: 'Phi-4' },
  { id: 'Meta-Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
  { id: 'Mistral-Small',               label: 'Mistral Small' },
] as const;

const DEFAULTS: Record<string, { primaryModel: string; fastModel: string }> = {
  free:     { primaryModel: 'gpt-4o', fastModel: 'gpt-4o-mini' },
  starter:  { primaryModel: 'gpt-4o', fastModel: 'gpt-4o-mini' },
  advanced: { primaryModel: 'gpt-4o', fastModel: 'gpt-4o-mini' },
};

const FALLBACK = { primaryModel: 'gpt-4o', fastModel: 'gpt-4o-mini' };
const CACHE_TTL_MS = 60_000;

type CachedEntry = { data: { primaryModel: string; fastModel: string }; expiresAt: number };
const cache = new Map<string, CachedEntry>();

export function invalidateCache(): void {
  cache.clear();
}

export async function getConfig(plan: string): Promise<{ primaryModel: string; fastModel: string }> {
  const now = Date.now();
  const cached = cache.get(plan);
  if (cached && cached.expiresAt > now) return cached.data;

  try {
    const row = await prisma.aIModelConfig.findUnique({ where: { plan } });
    const data = row
      ? { primaryModel: row.primaryModel, fastModel: row.fastModel }
      : (DEFAULTS[plan] ?? FALLBACK);
    cache.set(plan, { data, expiresAt: now + CACHE_TTL_MS });
    return data;
  } catch (err) {
    logger.warn({ err, plan }, 'aiConfigService.getConfig failed, using fallback');
    return DEFAULTS[plan] ?? FALLBACK;
  }
}

export async function listConfigs() {
  return prisma.aIModelConfig.findMany({ orderBy: { plan: 'asc' } });
}

export async function updateConfig(
  plan: string,
  primaryModel: string,
  fastModel: string,
  updatedBy: string
) {
  const result = await prisma.aIModelConfig.upsert({
    where: { plan },
    update: { primaryModel, fastModel, updatedBy },
    create: { plan, primaryModel, fastModel, updatedBy },
  });
  cache.delete(plan);
  return result;
}

export async function seedDefaults(): Promise<void> {
  try {
    const count = await prisma.aIModelConfig.count();
    if (count > 0) return;
    logger.info('Seeding default AI model configs...');
    for (const [plan, models] of Object.entries(DEFAULTS)) {
      await prisma.aIModelConfig.create({ data: { plan, ...models } });
    }
    logger.info('AI model config defaults seeded');
  } catch (err) {
    logger.warn({ err }, 'seedDefaults failed — app will use in-memory fallbacks');
  }
}
