import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Role } from '../../../../domain/Role';
import { RememberToken } from '../../../../domain/entities/RememberToken';
import { User } from '../../../../domain/entities/User';
import { DemoSandboxSlotSnapshot } from '../../../../domain/entities/DemoSandboxSlot';
import * as rtMod from '../../../maintenance/demoSandboxRuntime';
import * as ck from '../../../security/demoSandboxCookies';
import { issueDemoSandboxCsrfToken } from '../../../security/demoSandboxCsrfToken';
import { accessTokenSignOptions, JWT_ALGORITHM, JWT_ISSUER } from '../../../security/jwtOptions';
import * as ses from '../../../middlewares/demoSandboxSession';
import errorHandler from '../../../middlewares/errorHandler';
import { createDemoRouter } from '../demo';

const S_SEC = 'sandbox-secret-at-least-32-chars-long-001';
const P_SEC = 'prod-secret-at-least-32-chars-long-00001';
const BUYER = new User(1, 'Demo', 'Buyer', 'buyer@demo.test', 'hash', null, Role.USER, 'User');
const [A, R, C] = [ck.DEMO_AUTH_COOKIE, ck.DEMO_REFRESH_COOKIE, ck.DEMO_CSRF_COOKIE];
const asArr = (r: string[] | string | undefined) => (Array.isArray(r) ? r : r ? [r] : []);
const parseCk = (raw: string[] | string | undefined): Record<string, string> =>
  Object.fromEntries(
    asArr(raw)
      .map((s) => s.split(';')[0].split('='))
      .map(([k, ...v]) => [k.trim(), decodeURIComponent(v.join('='))]),
  );
const expectClr = (raw: string[] | string | undefined) =>
  [A, R, C].forEach((n) =>
    expect(asArr(raw).some((c) => c.startsWith(`${n}=;`) && c.includes('1970'))).toBe(true),
  );

function makeRuntime(busy = false) {
  let slot: DemoSandboxSlotSnapshot | null = null;
  const toks = new Map<string, RememberToken>();
  const save = (t: RememberToken) => (toks.set(t.tokenHash, t), t);
  const slotRepository = {
    claimAvailableSlot: jest.fn(async (leaseId: string, now: Date) => {
      if (busy) return null;
      const [t1, t2] = [new Date(now.getTime() + 6e4), new Date(now.getTime() + 3e5)];
      const s = { id: 'slot-1', status: 'leased', generation: 1, leaseId, allocatedAt: now };
      const snap = { ...s, lastActivityAt: now, idleExpiresAt: t1, absoluteExpiresAt: t2 };
      return (slot = snap as DemoSandboxSlotSnapshot);
    }),
    recordLeaseActivity: jest.fn(async (id: string) => (slot?.leaseId === id ? slot : null)),
    releaseLease: jest.fn(async (id: string, lid: string) =>
      slot?.id === id && slot.leaseId === lid ? (slot = { ...slot, status: 'draining' }) : null,
    ),
  };
  const rememberTokenRepo = {
    create: jest.fn(async (t: RememberToken) => save(t)),
    findByHash: jest.fn(async (h: string) => toks.get(h) ?? null),
    claimRotation: jest.fn(async (a: { presentedHash: string; successorHash: string }) => {
      const e = toks.get(a.presentedHash);
      if (!e || e.supersededAt || e.revokedAt) return false;
      Object.assign(e, { supersededAt: new Date(), successorHash: a.successorHash });
      return true;
    }),
    insertSuccessor: jest.fn(async (t: RememberToken) => save(t)),
    reapFamily: jest.fn(async () => 0),
    revokeFamily: jest.fn(async (fid: string) => {
      const rows = [...toks.values()].filter((t) => t.familyId === fid && !t.revokedAt);
      rows.forEach((t) => Object.assign(t, { revokedAt: new Date() }));
      return rows.length;
    }),
  };
  const uRepo = { findById: jest.fn(async (id: number) => (id === 1 ? BUYER : null)) };
  const uow = { runInTransaction: jest.fn(async <T>(w: (tx: unknown) => Promise<T>) => w({})) };
  const repositories = {
    getUserRepository: () => uRepo,
    getRememberTokenRepository: () => rememberTokenRepo,
    getUnitOfWork: () => uow,
  };
  const lp = { idleTimeoutMs: 6e4, maxLifetimeMs: 3e5 };
  const rt = { slotRepository, repositories, jwtSecret: S_SEC, leasePolicy: lp };
  const runtime = rt as unknown as rtMod.DemoSandboxRuntimeHandle;
  return { runtime, slotRepository, rememberTokenRepo, getSlot: () => slot };
}

function buildApp(sessionLimiterMax = 20, refreshLimiterMax = 20, sessionCeilingMax = 30) {
  const app = express().set('trust proxy', 1).use(express.json(), cookieParser());
  const router = createDemoRouter({ sessionLimiterMax, refreshLimiterMax, sessionCeilingMax });
  app.use('/api/demo', router).use(errorHandler);
  const post = (ip: string, c = '') =>
    request(app).post('/api/demo/session').set('X-Forwarded-For', ip).set('Cookie', c);
  const get = (c: string) => request(app).get('/api/demo/session').set('Cookie', c);
  const ref = (c = '', ip = '198.51.100.9') =>
    request(app).post('/api/demo/session/refresh').set('X-Forwarded-For', ip).set('Cookie', c);
  const del = (c: string[], h = '') =>
    request(app).delete('/api/demo/session').set('Cookie', c).set('x-csrf-token', h);
  return { app, post, get, ref, del };
}

afterEach(() => rtMod.setActiveDemoSandboxRuntime(null));

describe('/api/demo/session routes', () => {
  it('fails closed 404 when disabled and runs create -> get -> refresh -> delete -> 401', async () => {
    const { app } = buildApp();
    for (const m of ['post', 'get', 'delete'] as const) {
      expect((await request(app)[m]('/api/demo/session')).status).toBe(404);
    }
    expect((await request(app).get('/api/demo/status')).status).toBe(404);
    expect((await request(app).post('/api/demo/session/refresh')).status).toBe(404);
    const { runtime, slotRepository, rememberTokenRepo } = makeRuntime();
    rtMod.setActiveDemoSandboxRuntime(runtime);
    const { app: activeApp, post, get, ref, del } = buildApp();
    const st = await request(activeApp).get('/api/demo/status');
    expect([st.status, st.headers['cache-control'], st.body]).toEqual([
      200,
      'no-store',
      { enabled: true },
    ]);
    const res1 = await post('198.51.100.1');
    const raw = asArr(res1.headers['set-cookie']);
    const has = (p: string, f: string) => raw.some((c) => c.startsWith(`${p}=`) && c.includes(f));
    expect(res1.status).toBe(201);
    expect(has(A, 'HttpOnly') && has(A, 'Path=/api/demo')).toBe(true);
    expect(has(R, 'HttpOnly') && has(R, 'Path=/api/demo/session/refresh')).toBe(true);
    expect(has(C, 'Path=/') && !has(C, 'HttpOnly')).toBe(true);
    const c1 = parseCk(raw);
    const [g1, rot] = [await get(`${A}=${c1[A]}`), await ref(`${R}=${c1[R]}`)];
    const c2 = parseCk(rot.headers['set-cookie']);
    expect([g1.status, rot.status, c2[R] !== c1[R]]).toEqual([200, 200, true]);
    const dRes = await del([`${A}=${c2[A]}`, `${C}=${c2[C]}`], c2[C]);
    expect([dRes.status, rememberTokenRepo.revokeFamily.mock.calls.length]).toEqual([204, 1]);
    expect(slotRepository.releaseLease).toHaveBeenCalledTimes(1);
    expectClr(dRes.headers['set-cookie']);
    const after = await ref(`${R}=${c2[R]}`);
    expect([(await get(`${A}=${c2[A]}`)).status, after.status]).toEqual([401, 401]);
    expectClr(after.headers['set-cookie']);
  });

  it('handles busy 503, slot-leak release on error, and create/refresh rate limits', async () => {
    rtMod.setActiveDemoSandboxRuntime(makeRuntime(true).runtime);
    const busy = await buildApp().post('198.51.100.2');
    expect([busy.status, busy.headers['retry-after']]).toEqual([503, '30']);
    expect(busy.body.code).toBe('DEMO_SANDBOX_BUSY');
    const lim = buildApp(1, 1, 2);
    const [b1, b2, b3] = [
      await lim.post('198.51.100.3'),
      await lim.post('198.51.100.3'),
      await lim.post('198.51.100.3'),
    ];
    const [r1, r2] = [await lim.ref('', '198.51.100.3'), await lim.ref('', '198.51.100.3')];
    expect([b1.status, b2.status, b3.status, r1.status, r2.status]).toEqual([
      503, 503, 429, 401, 429,
    ]);
    expectClr(r1.headers['set-cookie']);
    rtMod.setActiveDemoSandboxRuntime(makeRuntime().runtime);
    const [ok1, lim2] = [await lim.post('198.51.100.7'), await lim.post('198.51.100.7')];
    expect([ok1.status, lim2.status]).toEqual([201, 429]);
    const failRt = makeRuntime();
    failRt.rememberTokenRepo.create.mockRejectedValueOnce(new Error('db write failed'));
    rtMod.setActiveDemoSandboxRuntime(failRt.runtime);
    const err = await buildApp().post('198.51.100.6');
    expect([err.status, err.headers['set-cookie']]).toEqual([500, undefined]);
    const s = failRt.getSlot()!;
    expect(failRt.slotRepository.releaseLease).toHaveBeenCalledWith(s.id, s.leaseId);
  });

  it('reuses active session on POST without re-allocating and releases slot when revoke fails', async () => {
    const { runtime, slotRepository, rememberTokenRepo } = makeRuntime();
    rtMod.setActiveDemoSandboxRuntime(runtime);
    const { post, del } = buildApp();
    const r1 = await post('198.51.100.8');
    const c1 = parseCk(r1.headers['set-cookie']);
    const r2 = await post('198.51.100.8', `${A}=${c1[A]}`);
    expect([r1.status, r2.status, slotRepository.claimAvailableSlot.mock.calls.length]).toEqual([
      201, 200, 1,
    ]);
    const c2 = parseCk(r2.headers['set-cookie']);
    rememberTokenRepo.revokeFamily.mockRejectedValueOnce(new Error('revoke boom'));
    const dRes = await del([`${A}=${c2[A]}`, `${C}=${c2[C]}`], c2[C]);
    expect([dRes.status, slotRepository.releaseLease.mock.calls.length]).toEqual([204, 1]);
    expectClr(dRes.headers['set-cookie']);
  });

  it('enforces CSRF, audience/secret isolation, and Buyer-only role on GET and /refresh', async () => {
    const { runtime, getSlot } = makeRuntime();
    rtMod.setActiveDemoSandboxRuntime(runtime);
    const { post, get, ref, del } = buildApp();
    const c = parseCk((await post('198.51.100.4')).headers['set-cookie']);
    const slot = getSlot()!;
    const [aCk, cCk] = [`${A}=${c[A]}`, `${C}=${c[C]}`];
    const ctx = { slotId: 'slot-2', leaseId: slot.leaseId!, userId: 1 };
    const cross = issueDemoSandboxCsrfToken(ctx, S_SEC);
    for (const r of [del([aCk, cCk]), del([aCk, cCk], 'bad'), del([aCk, `${C}=${cross}`], cross)]) {
      expect((await r).status).toBe(403);
    }
    const prod = jwt.sign({ userId: 1, idRole: Role.USER }, P_SEC, accessTokenSignOptions(900));
    const o = { algorithm: JWT_ALGORITHM, issuer: JWT_ISSUER, audience: 'mundo-3d-api' };
    const b = { userId: 1, slotId: slot.id, leaseId: slot.leaseId!, role: Role.USER };
    const badAud = jwt.sign({ ...b, typ: 'sandbox-access' }, S_SEC, o);
    const [g1, g2] = [await get(`${A}=${prod}`), await get(`${A}=${badAud}`)];
    expect([g1.status, g2.status]).toEqual([401, 401]);
    for (const role of [Role.STAFF, Role.ADMIN]) {
      const p = { userId: 2, slotId: slot.id, leaseId: slot.leaseId!, role };
      const aTok = ses.signDemoSandboxAccessToken(p, S_SEC);
      const rTok = ses.signDemoSandboxRefreshToken(p, S_SEC, slot.absoluteExpiresAt!);
      const [ga, rr] = [await get(`${A}=${aTok}`), await ref(`${R}=${rTok}`)];
      expect([ga.status, rr.status]).toEqual([403, 403]);
      expectClr(rr.headers['set-cookie']);
    }
  });
});
