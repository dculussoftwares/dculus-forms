import { Router, Request, Response } from 'express';
import { HTTP_STATUS } from '@dculus/utils';
import { prisma } from '../lib/prisma.js';

const router: Router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(HTTP_STATUS.OK).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

export { router as healthRouter };
