import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { validationResult } from 'express-validator';
import { Role } from '../../../domain/Role';
import { DemoSandboxSessionController } from '../../controllers/DemoSandboxSessionController';
import {
  createDemoSandboxBuyerControllers as getBuyer,
  type DemoSandboxBuyerControllers as Buyer,
} from '../../controllers/demoSandboxBuyerControllers';
import * as rtMod from '../../maintenance/demoSandboxRuntime';
import * as ses from '../../middlewares/demoSandboxSession';
import {
  demoProductCreateValidators,
  demoProductUpload,
  stripDemoUploadedFile,
} from '../../middlewares/demoSandboxUpload';
import handleValidationErrors from '../../middlewares/handleValidationErrors';
import { cartSyncValidation as cartVal } from '../../middlewares/validators/cartValidators';
import { customCommissionRequestValidators as commVal } from '../../middlewares/validators/customCommissionRequestValidators';
import {
  listMyOrdersValidation as myOrdVal,
  orderCreateValidation as ordVal,
} from '../../middlewares/validators/orderValidators';
import {
  productUpdateValidators as prodUpdVal,
  searchProductsValidation as searchVal,
} from '../../middlewares/validators/productValidators';

export interface DemoRouterOptions {
  sessionLimiterWindowMs?: number;
  sessionLimiterMax?: number;
  sessionCeilingMax?: number;
  refreshLimiterWindowMs?: number;
  refreshLimiterMax?: number;
  commissionLimiterWindowMs?: number;
  commissionLimiterMax?: number;
  roleSwitchLimiterWindowMs?: number;
  roleSwitchLimiterMax?: number;
  staffWriteLimiterWindowMs?: number;
  staffWriteLimiterMax?: number;
}

const makeLim = (windowMs: number, limit: number, error: string, skipFailedRequests = false) =>
  rateLimit({
    windowMs,
    limit,
    skipFailedRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    message: { error },
    statusCode: 429,
  });

const commErr = (req: Request, res: Response, next: NextFunction): void => {
  const errs = validationResult(req);
  if (errs.isEmpty()) return next();
  res.status(400).json({ errors: errs.array().map(({ msg }) => ({ msg })) });
};

const run =
  (pick: (b: Buyer) => RequestHandler): RequestHandler =>
  (req, res, next) => {
    const rt = rtMod.getActiveDemoSandboxRuntime();
    if (!rt || !req.sandbox) return void res.status(404).json({ message: 'Not found' });
    void Promise.resolve(pick(getBuyer(rt.repositories, req.sandbox.slotId))(req, res, next)).catch(
      next,
    );
  };

const READS: [string, (b: Buyer) => RequestHandler][] = [
  ['/products', (b) => b.products.index],
  ['/products/latest', (b) => b.products.latest],
  ['/products/:id', (b) => b.products.show],
  ['/product/:id', (b) => b.products.show],
  ['/categories', (b) => b.categories.index],
  ['/categories/:id', (b) => b.categories.show],
  ['/franchises', (b) => b.franchises.index],
  ['/franchises/:id', (b) => b.franchises.show],
  ['/orders/:id', (b) => b.orders.show],
];

export function createDemoRouter(o: DemoRouterOptions = {}): Router {
  const router = Router();
  const c = new DemoSandboxSessionController();
  const [w, auth] = [15 * 60 * 1000, ses.demoSandboxAuthMiddleware];
  const write = [auth, ses.demoSandboxCsrfMiddleware];
  const buyerOnly = ses.requireDemoRole(Role.USER);
  const staffOnly = ses.requireDemoRole(Role.STAFF);
  const staffRead = [auth, staffOnly];
  const staffWrite = [...write, staffOnly];
  const denyAdmin: RequestHandler = (_req, res) => {
    res.status(403).json({ error: 'ADMIN operations are forbidden in demo sandbox' });
  };
  const cMsg = 'Too many demo session requests. Please try again later.';
  const rMsg = 'Too many demo session refresh requests. Please try again later.';
  const cmMsg = 'Too many requests. Please try again later.';
  const roleMsg = 'Too many demo role switch requests. Please try again later.';
  const swMsg = 'Too many demo write requests. Please try again later.';
  const cCap = makeLim(o.sessionLimiterWindowMs ?? w, o.sessionCeilingMax ?? 30, cMsg, false);
  const cLim = makeLim(o.sessionLimiterWindowMs ?? w, o.sessionLimiterMax ?? 5, cMsg, true);
  const rLim = makeLim(o.refreshLimiterWindowMs ?? w, o.refreshLimiterMax ?? 10, rMsg);
  const cmLim = makeLim(
    o.commissionLimiterWindowMs ?? 3_600_000,
    o.commissionLimiterMax ?? 5,
    cmMsg,
  );
  const roleLim = makeLim(o.roleSwitchLimiterWindowMs ?? w, o.roleSwitchLimiterMax ?? 30, roleMsg);
  const swLim = makeLim(o.staffWriteLimiterWindowMs ?? w, o.staffWriteLimiterMax ?? 60, swMsg);
  const [hSearch, hMine] = [run((b) => b.products.search), run((b) => b.orders.listMine)];
  const [hCart, hOrd, hComm] = [
    run((b) => b.cart.syncCart),
    run((b) => b.orders.create),
    run((b) => b.commissions.create),
  ];
  router.use(ses.requireDemoSandboxEnabled);
  router.get('/status', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ enabled: true });
  });
  router.post('/session', cCap, cLim, c.create);
  router.get('/session', auth, c.get);
  router.post('/session/role', ...write, roleLim, c.switchRole);
  router.post('/session/refresh', rLim, c.refresh);
  router.delete('/session', ...write, c.destroy);
  router.get('/products/search', auth, searchVal, hSearch);
  router.get('/cart', auth, buyerOnly, run((b) => b.cart.getCart));
  router.get('/orders/mine', auth, buyerOnly, myOrdVal, hMine);
  for (const [path, pick] of READS) router.get(path, auth, run(pick));
  router.put('/cart', ...write, buyerOnly, cartVal, hCart);
  router.post('/orders', ...write, buyerOnly, ordVal, hOrd);
  router.post('/custom-commission-requests', ...write, cmLim, ...commVal, commErr, hComm);
  router.get(
    '/custom-commission-requests',
    ...staffRead,
    run((b) => b.commissions.list),
  );
  router.post(
    '/products',
    ...staffWrite,
    swLim,
    demoProductUpload,
    demoProductCreateValidators,
    handleValidationErrors,
    stripDemoUploadedFile,
    run((b) => b.products.create),
  );
  router.put(
    '/products/:id',
    ...staffWrite,
    swLim,
    demoProductUpload,
    stripDemoUploadedFile,
    prodUpdVal,
    handleValidationErrors,
    run((b) => b.products.update),
  );
  router.patch(
    '/products/:id/stock',
    ...staffWrite,
    swLim,
    run((b) => b.products.adjustStock),
  );
  router.delete('/products/:id', ...write, denyAdmin);
  router.get('/users/me', auth, run((b) => b.users.me));
  router.all('/users', auth, denyAdmin);
  router.all(
    '/users/:id',
    (req, _res, next) => (/^\d+$/.test(String(req.params.id)) ? next() : next('route')),
    auth,
    denyAdmin,
  );
  router.post('/categories', ...write, denyAdmin);
  router.put('/categories/:id', ...write, denyAdmin);
  router.delete('/categories/:id', ...write, denyAdmin);
  router.post('/franchises', ...write, denyAdmin);
  router.put('/franchises/:id', ...write, denyAdmin);
  router.delete('/franchises/:id', ...write, denyAdmin);
  router.get(
    '/orders',
    ...staffRead,
    run((b) => b.orders.index),
  );
  router.post('/orders/:id/confirm-payment', ...write, denyAdmin);
  router.post('/orders/:id/cancel', ...write, denyAdmin);
  return router;
}

export default createDemoRouter();
