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
import {
  categoryCreateValidators as catCreVal,
  categoryUpdateValidators as catUpdVal,
} from '../../middlewares/validators/categoryValidators';
import { customCommissionRequestValidators as commVal } from '../../middlewares/validators/customCommissionRequestValidators';
import {
  franchiseCreateValidators as franCreVal,
  franchiseUpdateValidators as franUpdVal,
} from '../../middlewares/validators/franchiseValidators';
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

const makeLim = (windowMs: number, max: number, error: string, skipFailedRequests = false) =>
  rateLimit({
    windowMs,
    max,
    skipFailedRequests,
    standardHeaders: 'draft-7',
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
  const workshopRole = ses.requireDemoRole(Role.STAFF, Role.ADMIN);
  const adminOnly = ses.requireDemoRole(Role.ADMIN);
  const workshopRead = [auth, workshopRole];
  const workshopWrite = [...write, workshopRole];
  const adminRead = [auth, adminOnly];
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
  const adminWrite = [...write, adminOnly, swLim];
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
    '/custom-commission-requests/mine',
    auth,
    buyerOnly,
    run((b) => b.commissions.listMine),
  );
  router.get(
    '/custom-commission-requests',
    ...workshopRead,
    run((b) => b.commissions.list),
  );
  router.post(
    '/products',
    ...workshopWrite,
    swLim,
    demoProductUpload,
    demoProductCreateValidators,
    handleValidationErrors,
    stripDemoUploadedFile,
    run((b) => b.products.create),
  );
  router.put(
    '/products/:id',
    ...workshopWrite,
    swLim,
    demoProductUpload,
    stripDemoUploadedFile,
    prodUpdVal,
    handleValidationErrors,
    run((b) => b.products.update),
  );
  router.patch(
    '/products/:id/stock',
    ...workshopWrite,
    swLim,
    run((b) => b.products.adjustStock),
  );
  router.delete('/products/:id', ...adminWrite, run((b) => b.products.destroy));
  // ORDER-SENSITIVE: `/users/me` MUST stay before `/users/:id`.
  router.get('/users/me', auth, run((b) => b.users.me));
  router.get('/users', ...adminRead, run((b) => b.users.index));
  router.get(
    '/users/:id',
    (req, _res, next) => (/^\d+$/.test(String(req.params.id)) ? next() : next('route')),
    ...adminRead,
    run((b) => b.users.show),
  );
  router.post('/categories', ...adminWrite, catCreVal, handleValidationErrors, run((b) => b.categories.create));
  router.put('/categories/:id', ...adminWrite, catUpdVal, handleValidationErrors, run((b) => b.categories.update));
  router.delete('/categories/:id', ...adminWrite, run((b) => b.categories.destroy));
  router.post('/franchises', ...adminWrite, franCreVal, handleValidationErrors, run((b) => b.franchises.create));
  router.put('/franchises/:id', ...adminWrite, franUpdVal, handleValidationErrors, run((b) => b.franchises.update));
  router.delete('/franchises/:id', ...adminWrite, run((b) => b.franchises.destroy));
  router.get(
    '/orders',
    ...workshopRead,
    run((b) => b.orders.index),
  );
  router.post('/orders/:id/confirm-payment', ...adminWrite, run((b) => b.orders.confirmPayment));
  router.post('/orders/:id/cancel', ...adminWrite, run((b) => b.orders.cancel));
  return router;
}

export default createDemoRouter();
