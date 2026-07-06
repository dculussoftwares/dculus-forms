import { Prisma } from '#prisma-client';
import { prisma } from '../../lib/prisma.js';

export interface EligibleResponseRow {
  id: string;
  data: Record<string, any>;
  submittedAt: Date;
}

export const countEligibleResponses = async (
  formId: string,
  pluginId: string
): Promise<number> => {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM "response" r
    WHERE r."formId" = ${formId}
      AND r."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "plugin_delivery" pd
        WHERE pd."pluginId" = ${pluginId}
          AND pd."responseId" = r.id
          AND pd.status = 'success'
      )
  `);

  return Number(rows[0]?.count ?? 0);
};

export const fetchEligibleResponseBatch = async (
  formId: string,
  pluginId: string,
  batchSize: number
): Promise<EligibleResponseRow[]> => {
  return prisma.$queryRaw<EligibleResponseRow[]>(Prisma.sql`
    SELECT r.id, r.data, r."submittedAt"
    FROM "response" r
    WHERE r."formId" = ${formId}
      AND r."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "plugin_delivery" pd
        WHERE pd."pluginId" = ${pluginId}
          AND pd."responseId" = r.id
          AND pd.status = 'success'
      )
    ORDER BY r."submittedAt" ASC
    LIMIT ${batchSize}
  `);
};
