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
import { User } from '../../../../domain/entities/User';
import { Role } from '../../../../domain/Role';
import * as rtMod from '../../../maintenance/demoSandboxRuntime';
import * as ses from '../../../middlewares/demoSandboxSession';
import errorHandler from '../../../middlewares/errorHandler';
import * as ck from '../../../security/demoSandboxCookies';
import { issueDemoSandboxCsrfToken } from '../../../security/demoSandboxCsrfToken';
import { createDemoRouter } from '../demo';

const SEC = 'sandbox-secret-at-least-32-chars-long-003';
const [A, C, B] = [ck.DEMO_AUTH_COOKIE, ck.DEMO_CSRF_COOKIE, '/api/demo'];
const [CAT, FRAN] = [new Category(1, 'Figura'), new Franchise(1, 'Marvel')];

function makeSlotRepos(slotLabel: string) {
  const products: Product[] = [
    new Product(
      1,
      'Busto Groot',
      2500,
      'Resina',
      'groot.jpg',
      1,
      1,
      CAT,
      FRAN,
      'PLA',
      15,
      10,
      10,
      null,
      null,
      10,
    ),
  ];
  const comms: Comm[] = [
    new Comm(
      1,
      'Ana',
      'ana@sandbox.invalid',
      'Busto a medida',
      1,
      new Date(),
      new Date(Date.now() + 86_400_000),
    ),
  ];
  const orders: Order[] = [
    new Order(
      1,
      1,
      `demo-seed-order-${slotLabel}`,
      OrderStatus.AWAITING_PAYMENT,
      [new OrderItem(1, 1, 1, `Busto Groot (${slotLabel})`, 1, 2500)],
      new Date('2026-01-01T12:00:00.000Z'),
    ),
  ];
  const users: User[] = [
    new User(
      1,
      slotLabel === 'slot-1' ? 'Demo' : 'Visitante',
      slotLabel === 'slot-1' ? 'Buyer' : 'Secreto',
      `demo.buyer+${slotLabel}@sandbox.mundo3d.invalid`,
      'hashed-secret',
      null,
      Role.USER,
      'User',
    ),
  ];
  return {
    productRepo: {
      findAll: jest.fn(async () => products),
      findById: jest.fn(async (id: number) => products.find((p) => p.idProduct === id) ?? null),
      create: jest.fn(async (input: Record<string, unknown>) => {
        const next = new Product(
          products.length + 1,
          String(input.nameProduct),
          Number(input.price),
          (input.descriptionProduct as string | null) ?? null,
          (input.image as string | null) ?? null,
          Number(input.idCategory),
          Number(input.idFranchise),
          CAT,
          FRAN,
          null,
          null,
          null,
          null,
          null,
          null,
          Number(input.stock ?? 0),
        );
        products.push(next);
        return next;
      }),
      update: jest.fn(async (id: number, input: Record<string, unknown>) => {
        const idx = products.findIndex((p) => p.idProduct === id);
        if (idx === -1) return null;
        const prev = products[idx];
        const upd = new Product(
          prev.idProduct,
          String(input.nameProduct ?? prev.nameProduct),
          Number(input.price ?? prev.price),
          (input.descriptionProduct as string | null | undefined) ?? prev.descriptionProduct,
          (input.image as string | null | undefined) ?? prev.image,
          Number(input.idCategory ?? prev.idCategory),
          Number(input.idFranchise ?? prev.idFranchise),
          CAT,
          FRAN,
          prev.material,
          prev.height,
          prev.width,
          prev.depth,
          prev.finish,
          prev.productionTime,
          prev.stock,
        );
        products[idx] = upd;
        return upd;
      }),
      adjustStock: jest.fn(async (id: number, delta: number) => {
        const idx = products.findIndex((p) => p.idProduct === id);
        if (idx === -1) return null;
        const prev = products[idx];
        const nextStock = (prev.stock ?? 0) + delta;
        if (nextStock < 0) throw new Error('Insufficient stock');
        const upd = new Product(
          prev.idProduct,
          prev.nameProduct,
          prev.price,
          prev.descriptionProduct,
          prev.image,
          prev.idCategory,
          prev.idFranchise,
          CAT,
          FRAN,
          prev.material,
          prev.height,
          prev.width,
          prev.depth,
          prev.finish,
          prev.productionTime,
          nextStock,
        );
        products[idx] = upd;
        return upd;
      }),
    },
    categoryRepo: {
      findAll: jest.fn(async () => [CAT]),
      findById: jest.fn(async (id: number) => (id === 1 ? CAT : null)),
    },
    franchiseRepo: { findAll: jest.fn(async () => [FRAN]) },
    cartRepo: {},
    orderRepo: {
      findAll: jest.fn(async () => orders),
      findById: jest.fn(async (id: number) => orders.find((o) => o.idOrder === id) ?? null),
    },
    userRepo: {
      findByIds: jest.fn(async (ids: readonly number[]) =>
        users.filter((u) => ids.includes(u.idUser)),
      ),
    },
    commRepo: { listActive: jest.fn(async () => comms) },
    uow: { runInTransaction: jest.fn(async <T>(w: (tx: unknown) => Promise<T>) => w({})) },
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
    getUserRepository: (id: string) => perSlot.get(id)!.userRepo,
    getCustomCommissionRequestRepository: (id: string) => perSlot.get(id)!.commRepo,
    getUnitOfWork: (id: string) => perSlot.get(id)!.uow,
  };
  const rt = {
    slotRepository,
    repositories,
    jwtSecret: SEC,
    leasePolicy: { idleTimeoutMs: 6e4, maxLifetimeMs: 3e5 },
  };
  return { runtime: rt as unknown as rtMod.DemoSandboxRuntimeHandle, perSlot };
}

const creds = (slotId: string, leaseId: string, userId: number, role: ses.AllowedDemoRole) => {
  const acc = ses.signDemoSandboxAccessToken({ userId, slotId, leaseId, role }, SEC);
  const csrf = issueDemoSandboxCsrfToken({ slotId, leaseId, userId }, SEC);
  return { cookies: [`${A}=${acc}`, `${C}=${csrf}`], csrf };
};

const BUYER1 = creds('slot-1', 'lease-1', 1, Role.USER);
const STAFF1 = creds('slot-1', 'lease-1', 2, Role.STAFF);

function buildApp(options?: Parameters<typeof createDemoRouter>[0]) {
  const app = express().set('trust proxy', 1).use(express.json(), cookieParser());
  app.use(B, createDemoRouter(options)).use(errorHandler);
  return app;
}

afterEach(() => rtMod.setActiveDemoSandboxRuntime(null));

describe('/api/demo/* STAFF endpoints and explicit 403 boundaries', () => {
  it('allows STAFF commission inbox + product create/update/stock inside slot without external uploads', async () => {
    const { runtime, perSlot } = makeRuntime();
    rtMod.setActiveDemoSandboxRuntime(runtime);
    const app = buildApp();

    const inbox = await request(app)
      .get(`${B}/custom-commission-requests`)
      .set('Cookie', STAFF1.cookies);
    expect([inbox.status, inbox.body.length]).toEqual([200, 1]);

    const ordersRes = await request(app).get(`${B}/orders`).set('Cookie', STAFF1.cookies);
    expect(ordersRes.status).toBe(200);
    expect(ordersRes.body).toHaveLength(1);
    expect(ordersRes.body[0].customer).toEqual({ idUser: 1, displayName: 'Demo B.' });
    expect(ordersRes.body[0].items[0].productName).toBe('Busto Groot (slot-1)');
    expect(JSON.stringify(ordersRes.body)).not.toContain('sandbox.mundo3d.invalid');
    expect(JSON.stringify(ordersRes.body)).not.toContain('Visitante');
    expect(JSON.stringify(ordersRes.body)).not.toContain('hashed-secret');

    const created = await request(app)
      .post(`${B}/products`)
      .set('Cookie', STAFF1.cookies)
      .set('x-csrf-token', STAFF1.csrf)
      .field('nameProduct', 'Figura Demo 3D')
      .field('price', '4500')
      .field('descriptionProduct', 'Pieza creada en sandbox')
      .field('idCategory', '1')
      .field('idFranchise', '1')
      .attach('image', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'preview.png',
        contentType: 'image/png',
      });
    expect([created.status, created.body.image]).toEqual([201, null]);

    const createdNoImage = await request(app)
      .post(`${B}/products`)
      .set('Cookie', STAFF1.cookies)
      .set('x-csrf-token', STAFF1.csrf)
      .send({
        nameProduct: 'Pieza Sin Foto',
        price: 3900,
        descriptionProduct: 'Sin archivo adjunto',
        idCategory: 1,
        idFranchise: 1,
      });
    expect([createdNoImage.status, createdNoImage.body.image]).toEqual([201, null]);

    const badExt = await request(app)
      .post(`${B}/products`)
      .set('Cookie', STAFF1.cookies)
      .set('x-csrf-token', STAFF1.csrf)
      .field('nameProduct', 'Figura Bad Ext')
      .field('price', '4500')
      .field('descriptionProduct', 'Archivo no permitido')
      .field('idCategory', '1')
      .field('idFranchise', '1')
      .attach('image', Buffer.from('plain'), { filename: 'note.txt', contentType: 'text/plain' });
    expect(badExt.status).toBe(400);

    const updated = await request(app)
      .put(`${B}/products/1`)
      .set('Cookie', STAFF1.cookies)
      .set('x-csrf-token', STAFF1.csrf)
      .field('nameProduct', 'Busto Editado')
      .field('price', '3100');
    expect([updated.status, updated.body.nameProduct, updated.body.image]).toEqual([
      200,
      'Busto Editado',
      'groot.jpg',
    ]);

    const stock = await request(app)
      .patch(`${B}/products/1/stock`)
      .set('Cookie', STAFF1.cookies)
      .set('x-csrf-token', STAFF1.csrf)
      .send({ delta: -3 });
    expect([stock.status, stock.body.stock]).toEqual([200, 7]);

    const slot2 = perSlot.get('slot-2')!;
    expect(slot2.productRepo.create).not.toHaveBeenCalled();
    expect(slot2.productRepo.update).not.toHaveBeenCalled();
    expect(slot2.productRepo.adjustStock).not.toHaveBeenCalled();
    expect(slot2.orderRepo.findAll).not.toHaveBeenCalled();
    expect(slot2.userRepo.findByIds).not.toHaveBeenCalled();
  });

  it('enforces real 403 on product delete, ADMIN routes, and Buyer attempts on STAFF routes', async () => {
    rtMod.setActiveDemoSandboxRuntime(makeRuntime().runtime);
    const app = buildApp();

    const adminChecks = [
      request(app)
        .delete(`${B}/products/1`)
        .set('Cookie', STAFF1.cookies)
        .set('x-csrf-token', STAFF1.csrf),
      request(app).get(`${B}/users`).set('Cookie', STAFF1.cookies),
      request(app).get(`${B}/users/1`).set('Cookie', STAFF1.cookies),
      request(app)
        .post(`${B}/categories`)
        .set('Cookie', STAFF1.cookies)
        .set('x-csrf-token', STAFF1.csrf),
      request(app)
        .delete(`${B}/categories/1`)
        .set('Cookie', STAFF1.cookies)
        .set('x-csrf-token', STAFF1.csrf),
      request(app)
        .post(`${B}/franchises`)
        .set('Cookie', STAFF1.cookies)
        .set('x-csrf-token', STAFF1.csrf),
      request(app)
        .delete(`${B}/franchises/1`)
        .set('Cookie', STAFF1.cookies)
        .set('x-csrf-token', STAFF1.csrf),
      request(app)
        .post(`${B}/orders/1/confirm-payment`)
        .set('Cookie', STAFF1.cookies)
        .set('x-csrf-token', STAFF1.csrf),
      request(app)
        .post(`${B}/orders/1/cancel`)
        .set('Cookie', STAFF1.cookies)
        .set('x-csrf-token', STAFF1.csrf),
      request(app).get(`${B}/orders`).set('Cookie', BUYER1.cookies),
      request(app).get(`${B}/custom-commission-requests`).set('Cookie', BUYER1.cookies),
      request(app)
        .post(`${B}/products`)
        .set('Cookie', BUYER1.cookies)
        .set('x-csrf-token', BUYER1.csrf),
      request(app)
        .put(`${B}/products/1`)
        .set('Cookie', BUYER1.cookies)
        .set('x-csrf-token', BUYER1.csrf),
      request(app)
        .patch(`${B}/products/1/stock`)
        .set('Cookie', BUYER1.cookies)
        .set('x-csrf-token', BUYER1.csrf),
      request(app)
        .delete(`${B}/products/1`)
        .set('Cookie', BUYER1.cookies)
        .set('x-csrf-token', BUYER1.csrf),
    ];
    for (const reqPromise of adminChecks) {
      expect((await reqPromise).status).toBe(403);
    }

    const unauthOrders = await request(app).get(`${B}/orders`);
    expect(unauthOrders.status).toBe(401);

    const staffOrderDetail = await request(app)
      .get(`${B}/orders/1`)
      .set('Cookie', STAFF1.cookies);
    expect(staffOrderDetail.status).toBe(404);
  });

  it('rejects missing or invalid CSRF with 403 on STAFF write routes', async () => {
    rtMod.setActiveDemoSandboxRuntime(makeRuntime().runtime);
    const app = buildApp();
    const checks = [
      request(app).post(`${B}/products`).set('Cookie', STAFF1.cookies).send({ nameProduct: 'Test 3D' }),
      request(app)
        .post(`${B}/products`)
        .set('Cookie', STAFF1.cookies)
        .set('x-csrf-token', 'invalid-csrf')
        .send({ nameProduct: 'Test 3D' }),
      request(app).put(`${B}/products/1`).set('Cookie', STAFF1.cookies).send({ price: 3000 }),
      request(app)
        .put(`${B}/products/1`)
        .set('Cookie', STAFF1.cookies)
        .set('x-csrf-token', 'invalid-csrf')
        .send({ price: 3000 }),
      request(app).patch(`${B}/products/1/stock`).set('Cookie', STAFF1.cookies).send({ delta: 1 }),
      request(app)
        .patch(`${B}/products/1/stock`)
        .set('Cookie', STAFF1.cookies)
        .set('x-csrf-token', 'invalid-csrf')
        .send({ delta: 1 }),
    ];
    for (const reqPromise of checks) {
      expect((await reqPromise).status).toBe(403);
    }
  });

  it('returns 413 on oversize upload (> 5 MB) without persisting product and rate-limits STAFF writes', async () => {
    const { runtime, perSlot } = makeRuntime();
    rtMod.setActiveDemoSandboxRuntime(runtime);
    const app = buildApp({ staffWriteLimiterMax: 2 });

    const oversize = await request(app)
      .post(`${B}/products`)
      .set('X-Forwarded-For', '198.51.100.40')
      .set('Cookie', STAFF1.cookies)
      .set('x-csrf-token', STAFF1.csrf)
      .field('nameProduct', 'Figura Pesada')
      .field('price', '4500')
      .field('descriptionProduct', 'Supera limite')
      .field('idCategory', '1')
      .field('idFranchise', '1')
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1, 0x61), {
        filename: 'huge.png',
        contentType: 'image/png',
      });
    expect(oversize.status).toBe(413);
    expect(oversize.body.error).toMatch(/5 MB/i);
    expect(perSlot.get('slot-1')!.productRepo.create).not.toHaveBeenCalled();

    const s1 = await request(app)
      .patch(`${B}/products/1/stock`)
      .set('X-Forwarded-For', '198.51.100.41')
      .set('Cookie', STAFF1.cookies)
      .set('x-csrf-token', STAFF1.csrf)
      .send({ delta: 1 });
    const s2 = await request(app)
      .patch(`${B}/products/1/stock`)
      .set('X-Forwarded-For', '198.51.100.41')
      .set('Cookie', STAFF1.cookies)
      .set('x-csrf-token', STAFF1.csrf)
      .send({ delta: 1 });
    const s3 = await request(app)
      .patch(`${B}/products/1/stock`)
      .set('X-Forwarded-For', '198.51.100.41')
      .set('Cookie', STAFF1.cookies)
      .set('x-csrf-token', STAFF1.csrf)
      .send({ delta: 1 });
    expect([s1.status, s2.status, s3.status]).toEqual([200, 200, 429]);
  });
});
