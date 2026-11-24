jest.mock('../../../../database/models/db', () => {
  throw new Error('default database forbidden');
});

import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { Category } from '../../../../domain/entities/Category';
import { CustomCommissionRequest as Comm } from '../../../../domain/entities/CustomCommissionRequest';
import { DemoSandboxSlotSnapshot as Snap } from '../../../../domain/entities/DemoSandboxSlot';
import { Franchise } from '../../../../domain/entities/Franchise';
import { Order, OrderStatus } from '../../../../domain/entities/Order';
import { OrderItem } from '../../../../domain/entities/OrderItem';
import { Product } from '../../../../domain/entities/Product';
import { CartStatus, ShoppingCart as Cart } from '../../../../domain/entities/ShoppingCart';
import type { CustomCommissionRequestRepositoryPort as CommP } from '../../../../domain/ports/CustomCommissionRequestRepositoryPort';
import type { OrderRepositoryPort as OrdP } from '../../../../domain/ports/OrderRepositoryPort';
import type { ShoppingCartRepositoryPort as CartP } from '../../../../domain/ports/ShoppingCartRepositoryPort';
import { Role } from '../../../../domain/Role';
import * as rtMod from '../../../maintenance/demoSandboxRuntime';
import * as ses from '../../../middlewares/demoSandboxSession';
import errorHandler from '../../../middlewares/errorHandler';
import * as ck from '../../../security/demoSandboxCookies';
import { issueDemoSandboxCsrfToken } from '../../../security/demoSandboxCsrfToken';
import { createDemoRouter } from '../demo';

const SEC = 'sandbox-secret-at-least-32-chars-long-002';
const [A, C, B] = [ck.DEMO_AUTH_COOKIE, ck.DEMO_CSRF_COOKIE, '/api/demo'];
const [CAT, FRAN] = [new Category(1, 'Figuras'), new Franchise(1, 'Dragon Ball')];
const PROD = new Product(1, 'Busto', 2500, 'Resina', null, 1, 1, CAT, FRAN);

function makeSlotRepos(slotId: string) {
  let cart: Cart[] = [];
  const orders: Order[] = [];
  const comms: Comm[] = [];
  const sync: CartP['syncCart'] = async (u, xs) => {
    const act = CartStatus.ACTIVE;
    cart = xs.map((x, i) => new Cart(i + 1, u, x.productId, x.quantity, x.unitPrice, act, PROD));
  };
  const mkOrd: OrdP['createWithItems'] = async ({ idUser, idempotencyKey, items: raw }) => {
    const id = orders.length + 1;
    const toIt = (x: (typeof raw)[number], i: number) =>
      new OrderItem(i + 1, id, x.idProduct, x.productName, x.quantity, x.unitPrice);
    const ord = new Order(
      id,
      idUser,
      idempotencyKey,
      OrderStatus.AWAITING_PAYMENT,
      raw.map(toIt),
      new Date(),
    );
    return (orders.push(ord), ord);
  };
  const mkComm: CommP['create'] = async (x) => {
    const { name, email, idea, idProduct, createdAt, expiresAt } = x;
    const r = new Comm(comms.length + 1, name, email, idea, idProduct, createdAt, expiresAt);
    return (comms.push(r), r);
  };
  const byKey = async (_u: number, k: string) => orders.find((o) => o.idempotencyKey === k) ?? null;
  return {
    productRepo: {
      findAll: jest.fn(async () => [PROD]),
      findById: jest.fn(async (id: number) => (id === 1 ? PROD : null)),
      adjustStock: jest.fn(async () => PROD),
    },
    categoryRepo: { findAll: jest.fn(async () => [CAT]) },
    franchiseRepo: { findAll: jest.fn(async () => [FRAN]) },
    cartRepo: {
      findByUserId: jest.fn(async () => cart),
      findActiveForUpdate: jest.fn(async () => cart),
      syncCart: jest.fn(sync),
      markOrdered: jest.fn(async (_u: number, ids: number[]) => ((cart = []), ids.length)),
    },
    orderRepo: {
      findByIdempotencyKey: jest.fn(byKey),
      createWithItems: jest.fn(mkOrd),
      attachPaymentReference: jest.fn(async () => undefined),
      findById: jest.fn(async (id: number) => orders.find((o) => o.idOrder === id) ?? null),
      findByUserId: jest.fn(async () => ({ orders, total: orders.length })),
    },
    commRepo: { create: jest.fn(mkComm) },
    uow: { runInTransaction: jest.fn(async <T>(w: (tx: unknown) => Promise<T>) => w({ slotId })) },
  };
}

function makeRuntime() {
  const now = new Date();
  const [t1, t2] = [new Date(now.getTime() + 6e4), new Date(now.getTime() + 3e5)];
  const base = { status: 'leased', generation: 1, allocatedAt: now, lastActivityAt: now };
  const slots = new Map<string, Snap>();
  const perSlot = new Map<string, ReturnType<typeof makeSlotRepos>>();
  for (const n of ['1', '2']) {
    const [id, leaseId] = [`slot-${n}`, `lease-${n}`];
    slots.set(leaseId, { ...base, id, leaseId, idleExpiresAt: t1, absoluteExpiresAt: t2 } as Snap);
    perSlot.set(id, makeSlotRepos(id));
  }
  const slotRepository = {
    recordLeaseActivity: jest.fn(async (l: string) => slots.get(l) ?? null),
  };
  const repositories = {
    get: (id: string) => perSlot.get(id)!.productRepo,
    getCategoryRepository: (id: string) => perSlot.get(id)!.categoryRepo,
    getFranchiseRepository: (id: string) => perSlot.get(id)!.franchiseRepo,
    getShoppingCartRepository: (id: string) => perSlot.get(id)!.cartRepo,
    getOrderRepository: (id: string) => perSlot.get(id)!.orderRepo,
    getCustomCommissionRequestRepository: (id: string) => perSlot.get(id)!.commRepo,
    getUnitOfWork: (id: string) => perSlot.get(id)!.uow,
  };
  const lp = { idleTimeoutMs: 6e4, maxLifetimeMs: 3e5 };
  const rt = { slotRepository, repositories, jwtSecret: SEC, leasePolicy: lp };
  return { runtime: rt as unknown as rtMod.DemoSandboxRuntimeHandle, perSlot };
}

const creds = (slotId: string, leaseId: string) => {
  const acc = ses.signDemoSandboxAccessToken({ userId: 1, slotId, leaseId, role: Role.USER }, SEC);
  const csrf = issueDemoSandboxCsrfToken({ slotId, leaseId, userId: 1 }, SEC);
  return { cookies: [`${A}=${acc}`, `${C}=${csrf}`], csrf };
};

const [S1, S2] = [creds('slot-1', 'lease-1'), creds('slot-2', 'lease-2')];

const makeSender = () => {
  const app = express().set('trust proxy', 1).use(express.json(), cookieParser());
  app.use(B, createDemoRouter({ commissionLimiterMax: 20 })).use(errorHandler);
  type M = 'get' | 'put' | 'post';
  type Cr = typeof S1;
  return (m: M, p: string, s?: Cr, csrf?: string, body?: object, idem?: string) => {
    let r = request(app)[m](`${B}${p}`);
    if (s) r = r.set('Cookie', s.cookies);
    if (csrf) r = r.set('x-csrf-token', csrf);
    if (idem) r = r.set('Idempotency-Key', idem);
    return body ? r.send(body) : r;
  };
};

afterEach(() => rtMod.setActiveDemoSandboxRuntime(null));

describe('/api/demo/* Buyer routes', () => {
  it('returns 404 when disabled and 401 when unauthenticated', async () => {
    const send = makeSender();
    const check = async (code: number) => {
      for (const p of ['/products', '/cart', '/orders/mine'])
        expect((await send('get', p)).status).toBe(code);
      for (const p of ['/orders', '/custom-commission-requests'])
        expect((await send('post', p)).status).toBe(code);
    };
    await check(404);
    rtMod.setActiveDemoSandboxRuntime(makeRuntime().runtime);
    await check(401);
  });

  it('executes full Buyer flow isolated to Slot 1 while Slot 2 stays empty', async () => {
    const { runtime, perSlot } = makeRuntime();
    rtMod.setActiveDemoSandboxRuntime(runtime);
    const send = makeSender();
    for (const p of ['/products', '/products/1', '/categories', '/franchises'])
      expect((await send('get', p, S1)).status).toBe(200);
    const putC = await send('put', '/cart', S1, S1.csrf, {
      items: [{ productId: 1, quantity: 2 }],
    });
    const [c1, c2] = [await send('get', '/cart', S1), await send('get', '/cart', S2)];
    const [ci1, ci2] = [c1.body.items.length, c2.body.items.length];
    expect([putC.status, c1.status, ci1, ci2]).toEqual([200, 200, 1, 0]);
    const ord = await send('post', '/orders', S1, S1.csrf, undefined, 'idem-1');
    const [m1, m2] = [await send('get', '/orders/mine', S1), await send('get', '/orders/mine', S2)];
    const show = await send('get', `/orders/${ord.body.idOrder}`, S1);
    const [o1, o2] = [m1.body.orders.length, m2.body.orders.length];
    expect([ord.status, o1, o2, show.status]).toEqual([201, 1, 0, 200]);
    const body = { name: 'Ana', email: 'ana@test.com', idea: 'Figura 15cm', idProduct: 1 };
    const cm = await send('post', '/custom-commission-requests', S1, S1.csrf, body);
    const r2 = perSlot.get('slot-2')!;
    const calls = [r2.cartRepo.syncCart, r2.orderRepo.createWithItems, r2.commRepo.create];
    expect([cm.status, ...calls.map((fn) => fn.mock.calls.length)]).toEqual([201, 0, 0, 0]);
  });

  it('rejects missing/cross-slot CSRF with 403 and returns 404 for unmounted routes', async () => {
    rtMod.setActiveDemoSandboxRuntime(makeRuntime().runtime);
    const send = makeSender();
    const m = [
      ['put', '/cart', { items: [{ productId: 1, quantity: 1 }] }],
      ['post', '/orders', {}],
      ['post', '/custom-commission-requests', { name: 'A', email: 'a@b.co', idea: 'x' }],
    ] as const;
    for (const [k, p, b] of m) {
      const [a, x] = [await send(k, p, S1, undefined, b), await send(k, p, S1, S2.csrf, b)];
      expect([a.status, x.status]).toEqual([403, 403]);
    }
    for (const p of ['/users/login', '/users/register']) {
      expect((await send('post', p, S1, S1.csrf)).status).toBe(404);
      expect((await send('post', p)).status).toBe(404);
    }
    expect((await send('get', '/admin/products', S1, S1.csrf)).status).toBe(404);
    expect((await send('get', '/orders', S1, S1.csrf)).status).toBe(403);
    expect((await send('post', '/orders/1/confirm-payment', S1, S1.csrf)).status).toBe(403);
    expect((await send('post', '/orders/1/cancel', S1, S1.csrf)).status).toBe(403);
    expect((await send('post', '/products', S1, S1.csrf)).status).toBe(403);
    expect((await send('get', '/custom-commission-requests', S1)).status).toBe(403);
  });
});
