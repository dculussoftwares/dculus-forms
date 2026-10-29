import { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createWebhookEventRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /**
   * Record a Chargebee event id as in-flight/processed. Returns false when the
   * id was already recorded (duplicate delivery).
   */
  const claim = async (id: string, eventType: string): Promise<boolean> => {
    try {
      await prisma.processedWebhookEvent.create({ data: { id, eventType } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  };

  /** Forget a claimed id so the sender's retry of a failed event is processed. */
  const release = (id: string) => prisma.processedWebhookEvent.deleteMany({ where: { id } });

  const purgeOlderThan = (cutoff: Date) =>
    prisma.processedWebhookEvent.deleteMany({ where: { processedAt: { lt: cutoff } } });

  return { claim, release, purgeOlderThan };
};

export type WebhookEventRepository = ReturnType<typeof createWebhookEventRepository>;

export const webhookEventRepository = createWebhookEventRepository();
