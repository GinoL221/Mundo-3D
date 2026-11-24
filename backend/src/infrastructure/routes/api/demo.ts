import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { DemoSandboxSessionController } from '../../controllers/DemoSandboxSessionController';
import * as ses from '../../middlewares/demoSandboxSession';

export interface DemoRouterOptions {
  sessionLimiterWindowMs?: number;
  sessionLimiterMax?: number;
  refreshLimiterWindowMs?: number;
  refreshLimiterMax?: number;
}

const makeLim = (windowMs: number, limit: number, error: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    message: { error },
    statusCode: 429,
  });

export function createDemoRouter(o: DemoRouterOptions = {}): Router {
  const router = Router();
  const c = new DemoSandboxSessionController();
  const w = 15 * 60 * 1000;
  const cMsg = 'Too many demo session requests. Please try again later.';
  const rMsg = 'Too many demo session refresh requests. Please try again later.';
  const cLim = makeLim(o.sessionLimiterWindowMs ?? w, o.sessionLimiterMax ?? 5, cMsg);
  const rLim = makeLim(o.refreshLimiterWindowMs ?? w, o.refreshLimiterMax ?? 10, rMsg);
  router.use(ses.requireDemoSandboxEnabled);
  router.post('/session', cLim, c.create);
  router.get('/session', ses.demoSandboxAuthMiddleware, c.get);
  router.post('/session/refresh', rLim, c.refresh);
  router.delete(
    '/session',
    ses.demoSandboxAuthMiddleware,
    ses.demoSandboxCsrfMiddleware,
    c.destroy,
  );
  return router;
}

export default createDemoRouter();
