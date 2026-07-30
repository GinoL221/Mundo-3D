import { Router, Request, Response } from 'express';
import { isReady } from '../health/readinessState';

const router = Router();

router.get('/live', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ status: 'ok' });
});

router.get('/ready', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  if (isReady()) {
    res.status(200).json({ status: 'ok' });
  } else {
    res.status(503).json({ status: 'unavailable' });
  }
});

export default router;
