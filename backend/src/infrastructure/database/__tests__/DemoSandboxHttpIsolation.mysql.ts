jest.mock('../../../database/models/db', () => {
  throw new Error('default database forbidden');
});
jest.mock('dotenv', () => {
  throw new Error('Sandbox integration must not load .env');
});

import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';
import { ResetDemoSandboxSlotUseCase } from '../../../application/use-cases/ResetDemoSandboxSlotUseCase';
import { Role } from '../../../domain/Role';
import {
  type DemoSandboxRuntimeHandle,
  setActiveDemoSandboxRuntime,
} from '../../maintenance/demoSandboxRuntime';
import { apiAuthMiddleware } from '../../middlewares/auth';
import * as ses from '../../middlewares/demoSandboxSession';
import errorHandler from '../../middlewares/errorHandler';
import { SequelizeDemoSandboxResetAdapter } from '../../persistence/SequelizeDemoSandboxResetAdapter';
import { SequelizeDemoSandboxSlotRepository } from '../../repositories/SequelizeDemoSandboxSlotRepository';
import { createDemoRouter } from '../../routes/api/demo';
import { AUTH_COOKIE } from '../../security/cookieOptions';
import * as ck from '../../security/demoSandboxCookies';
import { accessTokenSignOptions } from '../../security/jwtOptions';
import { getJwtSecret } from '../../security/JwtSecret';
import {
  createDemoSandboxConnections,
  type ManagedDemoSandboxConnections,
} from '../DemoSandboxConnections';
import { createDemoSandboxProductRepositories } from '../DemoSandboxProductRepositories';
import { DEMO_SANDBOX_EXPECTED_COUNTS as COUNTS } from '../demoSandboxSeedData';

type Mig = { up: (arg: { context: unknown }) => Promise<void> };
type Visitor = { auth: string; refresh: string; csrf: string; slotId: string; leaseId: string };

const [CONTAINER, PORT, CONTROL_DB] = ['m3d-sandbox-cut2-mysql', 33318, 'm3d_sandbox_cut2_control'];
const SLOT_DBS = ['m3d_sandbox_cut2_slot_1', 'm3d_sandbox_cut2_slot_2'] as const;
const SLOT_IDS = ['slot-1', 'slot-2'] as const;
const SLOT_USERS = ['m3d_cut2_1', 'm3d_cut2_2'] as const;
const [A, R, C] = [ck.DEMO_AUTH_COOKIE, ck.DEMO_REFRESH_COOKIE, ck.DEMO_CSRF_COOKIE];
const SANDBOX_SECRET = crypto.randomBytes(32).toString('hex');
const SLOT_MIGRATIONS: readonly Mig[] = [
  require('../../../database/migrations/20260724000000-baseline'),
  require('../../../database/migrations/20260828000000-orders'),
  require('../../../database/migrations/20260901000000-refresh-token-rotation'),
  require('../../../database/migrations/20260902000000-email-confirmation'),
  require('../../../database/migrations/20260927000000-custom-commission-requests'),
  require('../../../database/migrations/20261127000000-custom-commission-requests-user-and-phone'),
  require('../../../database/slot-migrations/20261102000000-demo-sandbox-fence'),
  require('../../../database/slot-migrations/20261103000000-demo-sandbox-reset-receipt'),
];
const CONTROL_MIGRATION: Mig = require('../../../database/migrations/20261026000000-demo-sandbox-slots');

const opened: Sequelize[] = [];
let controlDb: Sequelize;
let connections: ManagedDemoSandboxConnections;
let slotRepo: SequelizeDemoSandboxSlotRepository;
let resetAdapter: SequelizeDemoSandboxResetAdapter;
let runtime: DemoSandboxRuntimeHandle;
let app: Express;
let visitorA: Visitor;
let visitorB: Visitor;

function readConfig() {
  const required = {
    M3D_SANDBOX_TEST_AUTHORIZATION: CONTAINER,
    M3D_SANDBOX_TEST_HOST: '127.0.0.1',
    M3D_SANDBOX_TEST_PORT: String(PORT),
    M3D_SANDBOX_TEST_CONTROL_DATABASE: CONTROL_DB,
    M3D_SANDBOX_TEST_DATABASE_A: SLOT_DBS[0],
    M3D_SANDBOX_TEST_DATABASE_B: SLOT_DBS[1],
  };
  for (const [k, exp] of Object.entries(required)) {
    if (process.env[k] !== exp) throw new Error(`Explicit sandbox config required: ${k}`);
  }
  const passwords = [
    process.env.M3D_SANDBOX_TEST_ADMIN_PASSWORD,
    process.env.M3D_SANDBOX_TEST_PASSWORD_A,
    process.env.M3D_SANDBOX_TEST_PASSWORD_B,
  ];
  if (passwords.some((v) => !v || !/^[a-f0-9]{64}$/.test(v)) || new Set(passwords).size !== 3) {
    throw new Error('Three distinct 64-hex sandbox passwords must be supplied explicitly');
  }
  const uuid = process.env.M3D_SANDBOX_TEST_SERVER_UUID;
  if (!uuid || !/^[a-f0-9-]{36}$/.test(uuid)) throw new Error('Explicit sandbox UUID required');
  return { passwords: passwords as string[], uuid };
}

function adminConn(password: string, database = ''): Sequelize {
  const conn = new Sequelize(database, 'root', password, {
    dialect: 'mysql',
    host: '127.0.0.1',
    port: PORT,
    logging: false,
    pool: { min: 0, max: 1 },
    retry: { max: 0 },
  });
  opened.push(conn);
  return conn;
}

const sel = <T extends object>(conn: Sequelize, sql: string, replacements?: unknown[]) =>
  conn.query<T>(sql, { replacements, type: QueryTypes.SELECT });

async function countRows(conn: Sequelize, table: string, where = ''): Promise<number> {
  const rows = await sel<{ n: number }>(
    conn,
    `SELECT COUNT(*) AS n FROM \`${table}\`${where ? ` WHERE ${where}` : ''}`,
  );
  return Number(rows[0].n);
}

const parseCk = (raw: string[] | string | undefined): Record<string, string> =>
  Object.fromEntries(
    (Array.isArray(raw) ? raw : raw ? [raw] : [])
      .map((s) => s.split(';')[0].split('='))
      .map(([k, ...v]) => [k.trim(), decodeURIComponent(v.join('='))]),
  );

type Method = 'get' | 'put' | 'post' | 'patch' | 'delete';
const send = (
  m: Method,
  path: string,
  opts: { ck?: string | string[]; csrf?: string; body?: object; idem?: string; ip?: string } = {},
) => {
  let req = request(app)[m](path);
  if (opts.ip) req = req.set('X-Forwarded-For', opts.ip);
  if (opts.ck) req = req.set('Cookie', Array.isArray(opts.ck) ? opts.ck : [opts.ck]);
  if (opts.csrf) req = req.set('x-csrf-token', opts.csrf);
  if (opts.idem) req = req.set('Idempotency-Key', opts.idem);
  return opts.body ? req.send(opts.body) : req;
};

async function openVisitor(ip: string): Promise<Visitor> {
  const res = await send('post', '/api/demo/session', { ip });
  expect(res.status).toBe(201);
  const c = parseCk(res.headers['set-cookie']);
  const claims = ses.verifyDemoSandboxAccessToken(c[A], SANDBOX_SECRET);
  expect(claims).not.toBeNull();
  return {
    auth: c[A],
    refresh: c[R],
    csrf: c[C],
    slotId: claims!.slotId,
    leaseId: claims!.leaseId,
  };
}

beforeAll(async () => {
  const { passwords, uuid } = readConfig();
  const root = adminConn(passwords[0]);
  expect(await sel<{ uuid: string }>(root, 'SELECT @@server_uuid AS uuid')).toEqual([{ uuid }]);

  for (const dbName of [CONTROL_DB, ...SLOT_DBS]) {
    await root.query(`CREATE DATABASE \`${dbName}\``);
  }
  controlDb = adminConn(passwords[0], CONTROL_DB);
  await CONTROL_MIGRATION.up({ context: controlDb.getQueryInterface() });

  for (const [index, dbName] of SLOT_DBS.entries()) {
    const qi = adminConn(passwords[0], dbName).getQueryInterface();
    for (const mig of SLOT_MIGRATIONS) await mig.up({ context: qi });
    try {
      await root.query(
        `CREATE USER '${SLOT_USERS[index]}'@'%' IDENTIFIED BY '${passwords[index + 1]}'`,
      );
    } catch {
      throw new Error('Disposable slot account creation failed; credential SQL omitted');
    }
    await root.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${dbName}\`.* TO '${SLOT_USERS[index]}'@'%'`,
    );
  }

  connections = createDemoSandboxConnections({
    host: '127.0.0.1',
    port: PORT,
    controlPlaneDatabase: CONTROL_DB,
    slots: SLOT_IDS.map((slotId, i) => ({
      slotId,
      database: SLOT_DBS[i],
      username: SLOT_USERS[i],
      password: passwords[i + 1],
    })),
  });
  slotRepo = new SequelizeDemoSandboxSlotRepository(controlDb);
  await slotRepo.registerConfiguredSlots(SLOT_IDS, 5);
  resetAdapter = new SequelizeDemoSandboxResetAdapter(connections);
  for (const slotId of SLOT_IDS) await resetAdapter.reset(slotId, 0, crypto.randomUUID());

  runtime = {
    ready: Promise.resolve(),
    stop: () => connections.closeAll(),
    slotRepository: slotRepo,
    connections,
    repositories: createDemoSandboxProductRepositories(connections),
    jwtSecret: SANDBOX_SECRET,
    leasePolicy: {
      idleTimeoutMs: ck.DEMO_SANDBOX_IDLE_TIMEOUT_MS,
      maxLifetimeMs: ck.DEMO_SANDBOX_MAX_LIFETIME_MS,
    },
  };
  const lim = {
    sessionLimiterMax: 20,
    sessionCeilingMax: 50,
    refreshLimiterMax: 20,
    commissionLimiterMax: 20,
  };
  app = express().set('trust proxy', 1).use(express.json(), cookieParser());
  app.use('/api/demo', createDemoRouter(lim));
  app.get('/api/prod-probe', apiAuthMiddleware, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
}, 60_000);

afterAll(async () => {
  setActiveDemoSandboxRuntime(null);
  if (connections) await connections.closeAll();
  await Promise.allSettled(opened.splice(0).map((conn) => conn.close()));
});

describe('Demo Sandbox HTTP & MySQL 8.0 isolation', () => {
  it('1. fails closed with 404 when runtime is disabled', async () => {
    setActiveDemoSandboxRuntime(null);
    const checks = [
      send('post', '/api/demo/session'),
      send('get', '/api/demo/products'),
      send('put', '/api/demo/cart', { body: { items: [] } }),
      send('post', '/api/demo/orders'),
      send('post', '/api/demo/custom-commission-requests', { body: {} }),
    ];
    for (const pending of checks) expect((await pending).status).toBe(404);
  });

  it('2. isolates two concurrent Buyer slots end-to-end with zero main-DB leakage', async () => {
    setActiveDemoSandboxRuntime(runtime);
    visitorA = await openVisitor('198.51.100.11');
    const ckA = [`${A}=${visitorA.auth}`, `${C}=${visitorA.csrf}`];
    const prodA = await send('get', '/api/demo/products', { ck: ckA });
    expect([prodA.status, prodA.body.products.length]).toEqual([200, COUNTS.products]);

    const [cA, oA] = [
      await send('put', '/api/demo/cart', {
        ck: ckA,
        csrf: visitorA.csrf,
        body: { items: [{ productId: 1, quantity: 2 }] },
      }),
      await send('post', '/api/demo/orders', {
        ck: ckA,
        csrf: visitorA.csrf,
        idem: 'cut2d-order-1',
      }),
    ];
    const [mA, cmA] = [
      await send('get', '/api/demo/orders/mine', { ck: ckA }),
      await send('post', '/api/demo/custom-commission-requests', {
        ck: ckA,
        csrf: visitorA.csrf,
        body: {
          name: 'Ana',
          email: 'ana@example.invalid',
          phone: '+54 9 11 0000-8888',
          idea: 'Figura 15cm',
          idProduct: 1,
        },
      }),
    ];
    expect([cA.status, oA.status, mA.status, mA.body.orders.length, cmA.status]).toEqual([
      200,
      201,
      200,
      COUNTS.orders + 1,
      201,
    ]);

    visitorB = await openVisitor('198.51.100.12');
    expect(visitorB.slotId).not.toBe(visitorA.slotId);
    const ckB = [`${A}=${visitorB.auth}`, `${C}=${visitorB.csrf}`];
    const [pB, cB, mB, cA2, cmMineA, cmMineB] = await Promise.all([
      send('get', '/api/demo/products', { ck: ckB }),
      send('get', '/api/demo/cart', { ck: ckB }),
      send('get', '/api/demo/orders/mine', { ck: ckB }),
      send('get', '/api/demo/cart', { ck: ckA }),
      send('get', '/api/demo/custom-commission-requests/mine', { ck: ckA }),
      send('get', '/api/demo/custom-commission-requests/mine', { ck: ckB }),
    ]);
    expect([
      pB.body.products.length,
      cB.body.items.length,
      mB.body.orders.length,
      cmMineA.status,
      cmMineA.body.length,
      cmMineB.status,
      cmMineB.body.length,
    ]).toEqual([COUNTS.products, 0, COUNTS.orders, 200, 2, 200, 1]);
    expect(cA2.body.items.length).toBe(0);

    const [connA, connB] = [connections.get(visitorA.slotId), connections.get(visitorB.slotId)];
    expect([
      await countRows(connA, 'Order'),
      await countRows(connA, 'CustomCommissionRequest'),
      await countRows(connA, 'ShoppingCart', "cart_status = 'ACTIVE'"),
      await countRows(connB, 'Order'),
      await countRows(connB, 'CustomCommissionRequest'),
    ]).toEqual([
      COUNTS.orders + 1,
      COUNTS.customCommissionRequests + 1,
      0,
      COUNTS.orders,
      COUNTS.customCommissionRequests,
    ]);
    const ctrlTables = await sel<Record<string, string>>(controlDb, 'SHOW TABLES');
    expect(ctrlTables.map((row) => Object.values(row)[0])).toEqual(['DemoSandboxSlot']);
  }, 30_000);

  it('3. rejects cross-token auth, cross-slot CSRF (cookie+header), and ADMIN role', async () => {
    const prodTok = jwt.sign(
      { userId: 1, idRole: Role.USER, typ: 'access' },
      getJwtSecret(),
      accessTokenSignOptions(900),
    );
    const [p2d, d2p] = await Promise.all([
      send('get', '/api/demo/products', { ck: `${A}=${prodTok}` }),
      send('get', '/api/prod-probe', { ck: `${AUTH_COOKIE}=${visitorA.auth}` }),
    ]);
    expect([p2d.status, d2p.status]).toEqual([401, 401]);

    const crossCk = [`${A}=${visitorA.auth}`, `${C}=${visitorB.csrf}`];
    const [xCart, xOrd] = await Promise.all([
      send('put', '/api/demo/cart', {
        ck: crossCk,
        csrf: visitorB.csrf,
        body: { items: [{ productId: 1, quantity: 1 }] },
      }),
      send('post', '/api/demo/orders', {
        ck: crossCk,
        csrf: visitorB.csrf,
        idem: 'cut2d-cross-csrf',
      }),
    ]);
    expect([xCart.status, xOrd.status]).toEqual([403, 403]);

    const absExp = new Date(Date.now() + 60_000);
    const badRoleCl = {
      userId: 2,
      slotId: visitorA.slotId,
      leaseId: visitorA.leaseId,
      role: 99 as Role,
    };
    const acc = ses.signDemoSandboxAccessToken(badRoleCl, SANDBOX_SECRET);
    const ref = ses.signDemoSandboxRefreshToken(badRoleCl, SANDBOX_SECRET, absExp);
    const [gRes, rRes] = await Promise.all([
      send('get', '/api/demo/products', { ck: `${A}=${acc}` }),
      send('post', '/api/demo/session/refresh', { ck: `${R}=${ref}` }),
    ]);
    expect([gRes.status, rRes.status]).toEqual([403, 403]);
  });

  it('3b. switches slot A to STAFF, isolates inbox/catalog writes from slot B, and enforces 403 on delete/ADMIN', async () => {
    const sw = await send('post', '/api/demo/session/role', {
      ck: [`${A}=${visitorA.auth}`, `${C}=${visitorA.csrf}`],
      csrf: visitorA.csrf,
      body: { role: 'STAFF' },
    });
    expect([sw.status, sw.body.role, sw.body.user.idUser]).toEqual([200, 'STAFF', 2]);
    const c = parseCk(sw.headers['set-cookie']);
    visitorA = { ...visitorA, auth: c[A], refresh: c[R], csrf: c[C] };
    const ckStaff = [`${A}=${visitorA.auth}`, `${C}=${visitorA.csrf}`];

    const [inboxA, buyerInboxB, ordersA, buyerOrdersB] = await Promise.all([
      send('get', '/api/demo/custom-commission-requests', { ck: ckStaff }),
      send('get', '/api/demo/custom-commission-requests', { ck: `${A}=${visitorB.auth}` }),
      send('get', '/api/demo/orders', { ck: ckStaff }),
      send('get', '/api/demo/orders', { ck: `${A}=${visitorB.auth}` }),
    ]);
    expect([
      inboxA.status,
      inboxA.body.length,
      buyerInboxB.status,
      ordersA.status,
      ordersA.body.length,
      ordersA.body[0]?.customer?.displayName,
      buyerOrdersB.status,
    ]).toEqual([
      200,
      COUNTS.customCommissionRequests + 1,
      403,
      200,
      COUNTS.orders + 1,
      'Demo B.',
      403,
    ]);
    expect(JSON.stringify(ordersA.body)).not.toContain('sandbox.mundo3d.invalid');

    const created = await request(app)
      .post('/api/demo/products')
      .set('Cookie', ckStaff)
      .set('x-csrf-token', visitorA.csrf)
      .field('nameProduct', 'Busto Staff 3D')
      .field('price', '7900')
      .field('descriptionProduct', 'Alta STAFF aislada')
      .field('idCategory', '1')
      .field('idFranchise', '1')
      .field('stock', '3')
      .attach('image', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'preview.png',
        contentType: 'image/png',
      });
    expect([created.status, created.body.image]).toEqual([201, null]);
    const pid = created.body.idProduct as number;

    const [
      upd,
      stk,
      delProd,
      usrAdm,
      staffMe,
      staffCartGet,
      staffCartPut,
      staffOrdPost,
      staffMine,
      staffCommMine,
    ] = await Promise.all([
      send('put', `/api/demo/products/${pid}`, {
        ck: ckStaff,
        csrf: visitorA.csrf,
        body: { nameProduct: 'Busto Staff Edit', price: 8200 },
      }),
      send('patch', `/api/demo/products/${pid}/stock`, {
        ck: ckStaff,
        csrf: visitorA.csrf,
        body: { delta: 2 },
      }),
      send('delete', `/api/demo/products/${pid}`, { ck: ckStaff, csrf: visitorA.csrf }),
      send('get', '/api/demo/users', { ck: ckStaff }),
      send('get', '/api/demo/users/me', { ck: ckStaff }),
      send('get', '/api/demo/cart', { ck: ckStaff }),
      send('put', '/api/demo/cart', {
        ck: ckStaff,
        csrf: visitorA.csrf,
        body: { items: [{ productId: 1, quantity: 1 }] },
      }),
      send('post', '/api/demo/orders', {
        ck: ckStaff,
        csrf: visitorA.csrf,
        idem: 'staff-blocked-order',
      }),
      send('get', '/api/demo/orders/mine', { ck: ckStaff }),
      send('get', '/api/demo/custom-commission-requests/mine', { ck: ckStaff }),
    ]);
    expect([
      upd.status,
      stk.status,
      stk.body.stock,
      delProd.status,
      usrAdm.status,
      staffMe.status,
      staffMe.body.idUser,
      staffMe.body.idRole,
      staffCartGet.status,
      staffCartPut.status,
      staffOrdPost.status,
      staffMine.status,
      staffCommMine.status,
    ]).toEqual([200, 200, 5, 403, 403, 200, 2, Role.STAFF, 403, 403, 403, 403, 403]);

    const [connA, connB] = [connections.get(visitorA.slotId), connections.get(visitorB.slotId)];
    expect([await countRows(connA, 'Product'), await countRows(connB, 'Product')]).toEqual([
      COUNTS.products + 1,
      COUNTS.products,
    ]);

    // Switch visitor A to ADMIN inside the same lease and verify slot-scoped
    // ADMIN capabilities (users, taxonomy CRUD, order payment/cancel, delete product)
    // while buyer-only routes still return 403 and slot B stays untouched.
    const toAdmin = await send('post', '/api/demo/session/role', {
      ck: ckStaff,
      csrf: visitorA.csrf,
      body: { role: 'ADMIN' },
    });
    expect([toAdmin.status, toAdmin.body.role, toAdmin.body.user.idUser]).toEqual([
      200,
      'ADMIN',
      3,
    ]);
    const adminCk = parseCk(toAdmin.headers['set-cookie']);
    visitorA = {
      ...visitorA,
      auth: adminCk[A],
      refresh: adminCk[R],
      csrf: adminCk[C],
    };
    const ckAdmin = [`${A}=${visitorA.auth}`, `${C}=${visitorA.csrf}`];

    const [
      adminUsers,
      adminMe,
      adminCartGet,
      adminOrdPost,
      adminCatCreate,
      adminFranCreate,
      adminConfirmOrd,
      adminDeleteProd,
    ] = await Promise.all([
      send('get', '/api/demo/users', { ck: ckAdmin }),
      send('get', '/api/demo/users/me', { ck: ckAdmin }),
      send('get', '/api/demo/cart', { ck: ckAdmin }),
      send('post', '/api/demo/orders', {
        ck: ckAdmin,
        csrf: visitorA.csrf,
        idem: 'admin-blocked-order',
      }),
      send('post', '/api/demo/categories', {
        ck: ckAdmin,
        csrf: visitorA.csrf,
        body: { nameCategory: 'Dioramas Demo' },
      }),
      send('post', '/api/demo/franchises', {
        ck: ckAdmin,
        csrf: visitorA.csrf,
        body: { nameFranchise: 'Ghibli Demo' },
      }),
      send('post', '/api/demo/orders/1/confirm-payment', { ck: ckAdmin, csrf: visitorA.csrf }),
      send('delete', `/api/demo/products/${pid}`, { ck: ckAdmin, csrf: visitorA.csrf }),
    ]);

    expect([
      adminUsers.status,
      adminUsers.body.count,
      adminMe.status,
      adminMe.body.idRole,
      adminCartGet.status,
      adminOrdPost.status,
      adminCatCreate.status,
      adminFranCreate.status,
      adminConfirmOrd.status,
      adminConfirmOrd.body.status,
      adminDeleteProd.status,
    ]).toEqual([200, COUNTS.users, 200, Role.ADMIN, 403, 403, 201, 201, 200, 'PAID', 204]);
    expect(JSON.stringify(adminUsers.body)).not.toContain(visitorB.slotId.toLowerCase());
    expect([await countRows(connA, 'Category'), await countRows(connB, 'Category')]).toEqual([
      COUNTS.categories + 1,
      COUNTS.categories,
    ]);
    expect([await countRows(connA, 'Franchise'), await countRows(connB, 'Franchise')]).toEqual([
      COUNTS.franchises + 1,
      COUNTS.franchises,
    ]);
    expect([await countRows(connA, 'Product'), await countRows(connB, 'Product')]).toEqual([
      COUNTS.products,
      COUNTS.products,
    ]);
  }, 30_000);

  it('4. revokes tokens on DELETE /session, fences reset to available gen 1, and keeps slot B alive', async () => {
    const del = await send('delete', '/api/demo/session', {
      ck: [`${A}=${visitorA.auth}`, `${C}=${visitorA.csrf}`],
      csrf: visitorA.csrf,
    });
    expect(del.status).toBe(204);
    const slotSql = 'SELECT status, generation FROM `DemoSandboxSlot` WHERE slot_id = ?';
    const drained = await sel<{ status: string; generation: number }>(controlDb, slotSql, [
      visitorA.slotId,
    ]);
    expect(drained[0].status).toBe('draining');

    const connA = connections.get(visitorA.slotId);
    expect(await countRows(connA, 'RememberToken', 'revoked_at IS NOT NULL')).toBeGreaterThan(0);
    expect(await countRows(connA, 'RememberToken', 'revoked_at IS NULL')).toBe(0);

    const [afterProd, afterRef] = await Promise.all([
      send('get', '/api/demo/products', { ck: `${A}=${visitorA.auth}` }),
      send('post', '/api/demo/session/refresh', { ck: `${R}=${visitorA.refresh}` }),
    ]);
    expect([afterProd.status, afterRef.status]).toEqual([401, 401]);

    const resetUc = new ResetDemoSandboxSlotUseCase(
      slotRepo,
      resetAdapter,
      { now: () => new Date() },
      { next: () => crypto.randomUUID() },
    );
    await expect(resetUc.execute(visitorA.slotId, visitorA.leaseId)).resolves.toBe('available');
    expect(await sel(controlDb, slotSql, [visitorA.slotId])).toEqual([
      { status: 'available', generation: 1 },
    ]);
    expect([
      await countRows(connA, 'Product'),
      await countRows(connA, 'User'),
      await countRows(connA, 'Order'),
      await countRows(connA, 'OrderItem'),
      await countRows(connA, 'CustomCommissionRequest'),
      await countRows(connA, 'ShoppingCart'),
    ]).toEqual([
      COUNTS.products,
      COUNTS.users,
      COUNTS.orders,
      COUNTS.orderItems,
      COUNTS.customCommissionRequests,
      0,
    ]);

    const sesB = await send('get', '/api/demo/session', { ck: `${A}=${visitorB.auth}` });
    expect(sesB.status).toBe(200);
  }, 30_000);
});
