jest.mock('../../../../database/models', () => {
  const boom = () => {
    throw new Error('Default DB models must not be touched by demo ADMIN routes');
  };
  return {
    Product: { findAll: boom, findByPk: boom, create: boom, destroy: boom },
    Category: { findAll: boom, findByPk: boom, create: boom, destroy: boom },
    Franchise: { findAll: boom, findByPk: boom, create: boom, destroy: boom },
    Order: { findAll: boom, findByPk: boom, create: boom },
    User: { findAll: boom, findByPk: boom },
  };
});

import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { Order, OrderStatus } from '../../../../domain/entities/Order';
import { OrderItem } from '../../../../domain/entities/OrderItem';
import { Role } from '../../../../domain/Role';
import * as rtMod from '../../../maintenance/demoSandboxRuntime';
import * as ses from '../../../middlewares/demoSandboxSession';
import errorHandler from '../../../middlewares/errorHandler';
import * as ck from '../../../security/demoSandboxCookies';
import { issueDemoSandboxCsrfToken } from '../../../security/demoSandboxCsrfToken';
import { createDemoRouter } from '../demo';

const SEC = 'demo-admin-routes-secret-at-least-32-chars';

function makeAuth(slotId: string, leaseId: string, userId: number, role: ses.AllowedDemoRole) {
  const access = ses.signDemoSandboxAccessToken({ userId, slotId, leaseId, role }, SEC);
  const csrf = issueDemoSandboxCsrfToken({ slotId, leaseId, userId }, SEC);
  return { cookies: [`${ck.DEMO_AUTH_COOKIE}=${access}`, `${ck.DEMO_CSRF_COOKIE}=${csrf}`], csrf };
}

function makeSlot(slotId: string) {
  const product = {
    idProduct: 1,
    nameProduct: 'Busto Batman',
    price: 12000,
    descriptionProduct: 'Resina',
    image: null,
    idCategory: 1,
    idFranchise: 1,
    stock: 4,
  };
  const orders = new Map<number, Order>([
    [
      1,
      new Order(
        1,
        1,
        'demo-seed-order-1',
        OrderStatus.AWAITING_PAYMENT,
        [new OrderItem(1, 1, 1, 'Busto Batman', 2, 12000)],
        new Date('2026-01-01T00:00:00.000Z'),
        null,
      ),
    ],
    [
      2,
      new Order(
        2,
        1,
        'demo-seed-order-2',
        OrderStatus.AWAITING_PAYMENT,
        [new OrderItem(2, 2, 1, 'Busto Batman', 2, 12000)],
        new Date('2026-01-01T00:00:00.000Z'),
        null,
      ),
    ],
  ]);
  const users = [
    {
      idUser: 1,
      firstName: 'Demo',
      lastName: 'Buyer',
      email: `demo.buyer+${slotId}@sandbox.mundo3d.invalid`,
      image: null,
      passwordUser: 'hash',
      idRole: Role.USER,
      category: 'User',
    },
    {
      idUser: 2,
      firstName: 'Demo',
      lastName: 'Staff',
      email: `demo.staff+${slotId}@sandbox.mundo3d.invalid`,
      image: null,
      passwordUser: 'hash',
      idRole: Role.STAFF,
      category: 'Staff',
    },
    {
      idUser: 3,
      firstName: 'Demo',
      lastName: 'Admin',
      email: `demo.admin+${slotId}@sandbox.mundo3d.invalid`,
      image: null,
      passwordUser: 'hash',
      idRole: Role.ADMIN,
      category: 'Admin',
    },
  ];

  const productRepo = {
    findById: jest.fn(async (id: number) => (id === 1 ? product : null)),
    delete: jest.fn(async (id: number) => id === 1),
    adjustStock: jest.fn(async () => product),
  };
  const categoryRepo = {
    findAll: jest.fn(async () => [{ idCategory: 1, nameCategory: 'Busto' }]),
    findById: jest.fn(async (id: number) =>
      id === 1 ? { idCategory: 1, nameCategory: 'Busto' } : null,
    ),
    findByName: jest.fn(async () => null),
    create: jest.fn(async (data: { nameCategory: string }) => ({ idCategory: 2, ...data })),
    update: jest.fn(async (id: number, data: { nameCategory: string }) => ({
      idCategory: id,
      ...data,
    })),
    delete: jest.fn(async (id: number) => id === 2),
    countProducts: jest.fn(async () => 0),
  };
  const franchiseRepo = {
    findAll: jest.fn(async () => [{ idFranchise: 1, nameFranchise: 'DC' }]),
    findById: jest.fn(async (id: number) =>
      id === 1 ? { idFranchise: 1, nameFranchise: 'DC' } : null,
    ),
    findByName: jest.fn(async () => null),
    create: jest.fn(async (data: { nameFranchise: string }) => ({ idFranchise: 2, ...data })),
    update: jest.fn(async (id: number, data: { nameFranchise: string }) => ({
      idFranchise: id,
      ...data,
    })),
    delete: jest.fn(async (id: number) => id === 2),
    countProducts: jest.fn(async () => 0),
  };
  const orderRepo = {
    findById: jest.fn(async (id: number) => orders.get(id) ?? null),
    findAll: jest.fn(async () => [...orders.values()]),
    transitionStatus: jest.fn(async (id: number, from: OrderStatus, to: OrderStatus) => {
      const current = orders.get(id);
      if (!current || current.status !== from) return false;
      orders.set(
        id,
        new Order(
          current.idOrder,
          current.idUser,
          current.idempotencyKey,
          to,
          current.items,
          current.createdAt,
          to === OrderStatus.PAID ? 'MAN-1' : null,
        ),
      );
      return true;
    }),
  };
  const userRepo = {
    findAll: jest.fn(async () => users),
    findById: jest.fn(async (id: number) => users.find((u) => u.idUser === id) ?? null),
    findByIds: jest.fn(async (ids: number[]) => users.filter((u) => ids.includes(u.idUser))),
  };
  const uow = {
    runInTransaction: jest.fn(async <T>(work: (tx: unknown) => Promise<T>) => work({})),
  };

  return { productRepo, categoryRepo, franchiseRepo, orderRepo, userRepo, uow };
}

function makeRuntime() {
  const s1 = makeSlot('slot-1');
  const s2 = makeSlot('slot-2');
  const now = new Date();
  const slot1Snap = {
    id: 'slot-1',
    status: 'leased',
    leaseId: 'lease-1',
    idleExpiresAt: new Date(now.getTime() + 6e4),
    absoluteExpiresAt: new Date(now.getTime() + 3e5),
  };
  const slotRepository = {
    recordLeaseActivity: jest.fn(async (lid: string) => (lid === 'lease-1' ? slot1Snap : null)),
  };
  const pick = (id: string) => (id === 'slot-1' ? s1 : s2);
  const repositories = {
    get: (id: string) => pick(id).productRepo,
    getCategoryRepository: (id: string) => pick(id).categoryRepo,
    getFranchiseRepository: (id: string) => pick(id).franchiseRepo,
    getOrderRepository: (id: string) => pick(id).orderRepo,
    getUserRepository: (id: string) => pick(id).userRepo,
    getShoppingCartRepository: () => ({}),
    getCustomCommissionRequestRepository: () => ({ list: jest.fn(async () => []) }),
    getUnitOfWork: (id: string) => pick(id).uow,
  };
  const runtime = {
    slotRepository,
    repositories,
    jwtSecret: SEC,
    leasePolicy: { idleTimeoutMs: 6e4, maxLifetimeMs: 3e5 },
  } as unknown as rtMod.DemoSandboxRuntimeHandle;
  return { runtime, s1, s2 };
}

describe('Demo Sandbox ADMIN routes & strict per-slot isolation', () => {
  afterEach(() => {
    rtMod.setActiveDemoSandboxRuntime(null);
    jest.restoreAllMocks();
  });

  const buildApp = () =>
    express()
      .use(express.json(), cookieParser())
      .use('/api/demo', createDemoRouter())
      .use(errorHandler);

  it('allows slot-scoped ADMIN operations without touching sibling slot or default DB, and blocks buyer-only endpoints', async () => {
    const { runtime, s1, s2 } = makeRuntime();
    rtMod.setActiveDemoSandboxRuntime(runtime);
    const app = buildApp();
    const ADM = makeAuth('slot-1', 'lease-1', 3, Role.ADMIN);

    const [
      usersRes,
      userOneRes,
      meRes,
      orderDetailRes,
      confirmRes,
      cancelRes,
      catPost,
      catPut,
      catDel,
      franPost,
      franPut,
      franDel,
      prodDel,
      cartGet,
      cartPut,
      ordPost,
      ordMine,
    ] = await Promise.all([
      request(app).get('/api/demo/users').set('Cookie', ADM.cookies),
      request(app).get('/api/demo/users/1').set('Cookie', ADM.cookies),
      request(app).get('/api/demo/users/me').set('Cookie', ADM.cookies),
      request(app).get('/api/demo/orders/1').set('Cookie', ADM.cookies),
      request(app)
        .post('/api/demo/orders/1/confirm-payment')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf),
      request(app)
        .post('/api/demo/orders/2/cancel')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf),
      request(app)
        .post('/api/demo/categories')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf)
        .send({ nameCategory: 'Dioramas' }),
      request(app)
        .put('/api/demo/categories/1')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf)
        .send({ nameCategory: 'Bustos' }),
      request(app)
        .delete('/api/demo/categories/2')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf),
      request(app)
        .post('/api/demo/franchises')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf)
        .send({ nameFranchise: 'Ghibli' }),
      request(app)
        .put('/api/demo/franchises/1')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf)
        .send({ nameFranchise: 'DC Comics' }),
      request(app)
        .delete('/api/demo/franchises/2')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf),
      request(app)
        .delete('/api/demo/products/1')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf),
      request(app).get('/api/demo/cart').set('Cookie', ADM.cookies),
      request(app)
        .put('/api/demo/cart')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf)
        .send({ items: [{ productId: 1, quantity: 1 }] }),
      request(app)
        .post('/api/demo/orders')
        .set('Cookie', ADM.cookies)
        .set('x-csrf-token', ADM.csrf)
        .set('Idempotency-Key', 'admin-blocked'),
      request(app).get('/api/demo/orders/mine').set('Cookie', ADM.cookies),
    ]);

    expect(usersRes.status).toBe(200);
    expect(usersRes.body.count).toBe(3);
    expect(JSON.stringify(usersRes.body)).not.toContain('passwordUser');
    expect(userOneRes.status).toBe(200);
    expect(userOneRes.body.idUser).toBe(1);
    expect(meRes.status).toBe(200);
    expect(meRes.body.idRole).toBe(Role.ADMIN);
    expect(orderDetailRes.status).toBe(200);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe(OrderStatus.PAID);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe(OrderStatus.CANCELLED);
    expect(s1.productRepo.adjustStock).toHaveBeenCalledWith(1, 2, expect.anything());
    expect([catPost.status, catPut.status, catDel.status]).toEqual([201, 200, 204]);
    expect([franPost.status, franPut.status, franDel.status]).toEqual([201, 200, 204]);
    expect(prodDel.status).toBe(204);
    expect([cartGet.status, cartPut.status, ordPost.status, ordMine.status]).toEqual([
      403, 403, 403, 403,
    ]);

    // Sibling slot-2 is NEVER touched
    expect(s2.userRepo.findAll).not.toHaveBeenCalled();
    expect(s2.productRepo.delete).not.toHaveBeenCalled();
    expect(s2.orderRepo.transitionStatus).not.toHaveBeenCalled();
    expect(s2.categoryRepo.create).not.toHaveBeenCalled();
    expect(s2.franchiseRepo.create).not.toHaveBeenCalled();
  });
});
