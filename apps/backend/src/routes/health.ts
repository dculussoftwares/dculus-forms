import { Router, Request, Response } from 'express';
import { HTTP_STATUS } from '@dculus/utils';

const router: Router = Router();

router.get('/', (req: Request, res: Response) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { router as healthRouter }; 