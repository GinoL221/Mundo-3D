import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../../../domain/Role';
import * as rtMod from '../../maintenance/demoSandboxRuntime';
import * as ck from '../../security/demoSandboxCookies';
import { issueDemoSandboxCsrfToken } from '../../security/demoSandboxCsrfToken';
import { JWT_ALGORITHM, JWT_ISSUER } from '../../security/jwtOptions';
import * as s from '../demoSandboxSession';

const SEC = 'sandbox-secret-at-least-32-chars-long-001';
const L = { userId: 1, slotId: 'slot-1', leaseId: 'lease-1', role: Role.USER };
const mkRes = () => {
  const r = { status: jest.fn(), json: jest.fn() };
  r.status.mockReturnValue(r);
  return r as unknown as Response & { status: jest.Mock };
};
const req = (o: Record<string, unknown>) => o as unknown as Request;
const acc = (p = {}) => s.signDemoSandboxAccessToken({ ...L, ...p }, SEC);
const setRt = (ok = true) => {
  const rec = ok
    ? { ...L, id: L.slotId, status: 'leased', idleExpiresAt: new Date(Date.now() + 6e4) }
    : null;
  if (rec) Object.assign(rec, { absoluteExpiresAt: new Date(Date.now() + 3e5) });
  const lp = { idleTimeoutMs: 6e4, maxLifetimeMs: 3e5 };
  const slotRepository = { recordLeaseActivity: async () => rec };
  const rt = { jwtSecret: SEC, leasePolicy: lp, slotRepository };
  rtMod.setActiveDemoSandboxRuntime(rt as unknown as rtMod.DemoSandboxRuntimeHandle);
};

afterEach(() => rtMod.setActiveDemoSandboxRuntime(null));

describe('demoSandboxSession', () => {
  it('verifies tokens and rejects wrong aud, secret, typ, or blank familyId', () => {
    const a = acc({ familyId: 'fam-1' });
    const r = s.signDemoSandboxRefreshToken(L, SEC, new Date(Date.now() + 6e4));
    expect(s.verifyDemoSandboxAccessToken(a, SEC)).toEqual({ ...L, familyId: 'fam-1' });
    expect(s.verifyDemoSandboxRefreshToken(r, SEC)).toEqual(L);
    expect(s.verifyDemoSandboxRefreshToken(a, SEC)).toBeNull();
    const o = { algorithm: JWT_ALGORITHM, issuer: JWT_ISSUER, audience: 'mundo-3d-api' };
    const badAud = jwt.sign({ ...L, typ: 'sandbox-access' }, SEC, o);
    for (const t of [r, badAud, acc({ familyId: ' ' })]) {
      expect(s.verifyDemoSandboxAccessToken(t, SEC)).toBeNull();
    }
    expect(s.verifyDemoSandboxAccessToken(a, 'other-secret-at-least-32-chars-00000')).toBeNull();
  });

  it('enforces runtime, Buyer role, active lease, and CSRF double-submit', async () => {
    const [next, ok] = [jest.fn(), jest.fn()];
    const [r404, r403, r401, bad] = [mkRes(), mkRes(), mkRes(), mkRes()];
    s.requireDemoSandboxEnabled(req({}), r404, next);
    expect(r404.status).toHaveBeenCalledWith(404);
    setRt(true);
    s.requireDemoSandboxEnabled(req({}), mkRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    const aReq = req({ cookies: { [ck.DEMO_AUTH_COOKIE]: acc({ familyId: 'fam-9' }) } });
    await s.demoSandboxAuthMiddleware(aReq, mkRes(), next);
    expect(aReq.sandbox).toMatchObject({ slotId: 'slot-1', leaseId: 'lease-1', familyId: 'fam-9' });
    const sReq = req({ cookies: { [ck.DEMO_AUTH_COOKIE]: acc({ userId: 2, role: Role.STAFF }) } });
    await s.demoSandboxAuthMiddleware(sReq, mkRes(), next);
    expect(sReq.user).toEqual({ userId: 2, role: Role.STAFF, idRole: Role.STAFF });
    const admReq = req({
      cookies: { [ck.DEMO_AUTH_COOKIE]: acc({ userId: 3, role: Role.ADMIN }) },
    });
    await s.demoSandboxAuthMiddleware(admReq, mkRes(), next);
    expect(admReq.user).toEqual({ userId: 3, role: Role.ADMIN, idRole: Role.ADMIN });
    const badRoleReq = req({
      cookies: { [ck.DEMO_AUTH_COOKIE]: acc({ userId: 9, role: 99 as Role }) },
    });
    await s.demoSandboxAuthMiddleware(badRoleReq, r403, next);
    expect(r403.status).toHaveBeenCalledWith(403);
    const roleGuard = s.requireDemoRole(Role.STAFF);
    const rRole403 = mkRes();
    const roleOk = jest.fn();
    roleGuard(aReq, rRole403, roleOk);
    expect(rRole403.status).toHaveBeenCalledWith(403);
    roleGuard(sReq, mkRes(), roleOk);
    expect(roleOk).toHaveBeenCalledTimes(1);
    const adminGuard = s.requireDemoRole(Role.ADMIN);
    const rAdmin403 = mkRes();
    const adminOk = jest.fn();
    adminGuard(sReq, rAdmin403, adminOk);
    expect(rAdmin403.status).toHaveBeenCalledWith(403);
    adminGuard(admReq, mkRes(), adminOk);
    expect(adminOk).toHaveBeenCalledTimes(1);
    setRt(false);
    await s.demoSandboxAuthMiddleware(aReq, r401, next);
    expect(r401.status).toHaveBeenCalledWith(401);
    setRt(true);
    const csrf = issueDemoSandboxCsrfToken(L, SEC);
    s.demoSandboxCsrfMiddleware(req({ method: 'GET' }), mkRes(), next);
    const ckObj = { [ck.DEMO_CSRF_COOKIE]: csrf };
    const b = { method: 'DELETE', cookies: ckObj, sandbox: aReq.sandbox, user: aReq.user };
    s.demoSandboxCsrfMiddleware(req({ ...b, headers: { 'x-csrf-token': 'bad' } }), bad, next);
    expect(bad.status).toHaveBeenCalledWith(403);
    s.demoSandboxCsrfMiddleware(req({ ...b, headers: { 'x-csrf-token': csrf } }), mkRes(), ok);
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
