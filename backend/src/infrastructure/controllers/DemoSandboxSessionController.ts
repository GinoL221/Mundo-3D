import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AllocateDemoSandboxLeaseUseCase } from '../../application/use-cases/AllocateDemoSandboxLeaseUseCase';
import { ReleaseDemoSandboxLeaseUseCase } from '../../application/use-cases/ReleaseDemoSandboxLeaseUseCase';
import { Role } from '../../domain/Role';
import { createDemoSandboxAuthUseCases } from '../database/DemoSandboxAuthUseCases';
import { logger } from '../logging/logger';
import * as rtMod from '../maintenance/demoSandboxRuntime';
import * as ses from '../middlewares/demoSandboxSession';
import { BcryptPasswordHasher } from '../security/BcryptPasswordHasher';
import { CryptoRandomIdGenerator } from '../security/CryptoRandomIdGenerator';
import * as ck from '../security/demoSandboxCookies';
import { issueDemoSandboxCsrfToken } from '../security/demoSandboxCsrfToken';
import { REFRESH_TOKEN_REAP_SECONDS } from '../security/refreshTokenRetention';
import { Sha256TokenHasher } from '../security/Sha256TokenHasher';

const BUYER_ID = 1;
const STAFF_ID = 2;
const BUSY = {
  code: 'DEMO_SANDBOX_BUSY',
  message: 'All demo sessions are currently in use. Please try again shortly.',
};
const authDeps = {
  passwordHasher: new BcryptPasswordHasher(),
  tokenHasher: new Sha256TokenHasher(),
  idGenerator: new CryptoRandomIdGenerator(),
  logger,
  reapSeconds: REFRESH_TOKEN_REAP_SECONDS,
};
type Rt = rtMod.DemoSandboxRuntimeHandle;
type DemoAccount = { idUser: number; firstName: string; lastName: string; email: string };
const fmt = (
  u: DemoAccount,
  role: ses.AllowedDemoRole,
  lease: Record<string, Date | undefined>,
) => ({
  active: true,
  role: role === Role.STAFF ? 'STAFF' : 'USER',
  user: { idUser: u.idUser, firstName: u.firstName, lastName: u.lastName, email: u.email },
  lease,
});
const clearCk = (res: Response): void => {
  res.clearCookie(ck.DEMO_AUTH_COOKIE, ck.demoAccessCookieOptions());
  res.clearCookie(ck.DEMO_REFRESH_COOKIE, ck.demoRefreshCookieOptions());
  res.clearCookie(ck.DEMO_CSRF_COOKIE, ck.demoCsrfCookieOptions());
};
const fail = (res: Response, status: number, error: string, clear = false): void => {
  if (clear) clearCk(res);
  res.status(status).json({ error });
};
const reqRt = (res: Response): Rt | null => {
  const rt = rtMod.getActiveDemoSandboxRuntime();
  if (!rt) res.status(404).json({ message: 'Not found' });
  return rt;
};
const relSlot = (rt: Rt, id: string, lid: string) =>
  new ReleaseDemoSandboxLeaseUseCase(rt.slotRepository).execute(id, lid).catch((err: unknown) => {
    logger.warn({ slotId: id, err }, 'Demo sandbox slot release failed');
  });
const busyRes = (res: Response) => res.setHeader('Retry-After', '30').status(503).json(BUSY);

function setCk(
  res: Response,
  rt: Rt,
  slotId: string,
  leaseId: string,
  userId: number,
  role: ses.AllowedDemoRole,
  abs: Date,
  familyId?: string,
  ref?: string,
): void {
  const maxAge = Math.max(0, abs.getTime() - Date.now());
  const base = { userId, slotId, leaseId, role };
  const payload = familyId ? { ...base, familyId } : base;
  const acc = ses.signDemoSandboxAccessToken(payload, rt.jwtSecret);
  const csrf = issueDemoSandboxCsrfToken({ slotId, leaseId, userId }, rt.jwtSecret);
  res.cookie(ck.DEMO_AUTH_COOKIE, acc, ck.demoAccessCookieOptions(maxAge));
  if (ref) res.cookie(ck.DEMO_REFRESH_COOKIE, ref, ck.demoRefreshCookieOptions(maxAge));
  res.cookie(ck.DEMO_CSRF_COOKIE, csrf, ck.demoCsrfCookieOptions(maxAge));
}

export class DemoSandboxSessionController {
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rt = reqRt(res);
    if (!rt) return;
    let alloc: { id: string; leaseId: string } | null = null;
    try {
      const raw = req.cookies?.[ck.DEMO_AUTH_COOKIE];
      const existing =
        typeof raw === 'string' ? ses.verifyDemoSandboxAccessToken(raw, rt.jwtSecret) : null;
      if (existing && ses.isAllowedDemoRole(existing.role)) {
        const lease = await ses.validateActiveSandboxLease(rt, existing);
        if (lease) {
          const active = await rt.repositories
            .getUserRepository(lease.slotId)
            .findById(existing.userId);
          if (active && Number(active.idRole) === Number(existing.role)) {
            const { slotId, leaseId, idleExpiresAt, absoluteExpiresAt } = lease;
            setCk(
              res,
              rt,
              slotId,
              leaseId,
              active.idUser,
              existing.role,
              absoluteExpiresAt,
              existing.familyId,
            );
            res.status(200).json(fmt(active, existing.role, { idleExpiresAt, absoluteExpiresAt }));
            return;
          }
        }
      }
      const [clk, ids] = [{ now: () => new Date() }, { next: () => crypto.randomUUID() }];
      const uc = new AllocateDemoSandboxLeaseUseCase(rt.slotRepository, rt.leasePolicy, clk, ids);
      const s = await uc.execute();
      if (!s?.leaseId || !s.allocatedAt || !s.idleExpiresAt || !s.absoluteExpiresAt) {
        busyRes(res);
        return;
      }
      alloc = { id: s.id, leaseId: s.leaseId };
      const buyer = await rt.repositories.getUserRepository(s.id).findById(BUYER_ID);
      if (!buyer || Number(buyer.idRole) !== Number(Role.USER)) {
        logger.warn({ slotId: s.id }, 'Demo sandbox slot missing valid Buyer seed');
        await relSlot(rt, s.id, s.leaseId);
        busyRes(res);
        return;
      }
      const auth = createDemoSandboxAuthUseCases(rt.repositories, s.id, authDeps);
      const cl = { userId: buyer.idUser, slotId: s.id, leaseId: s.leaseId, role: Role.USER };
      const ref = ses.signDemoSandboxRefreshToken(cl, rt.jwtSecret, s.absoluteExpiresAt);
      const ttl = Math.max(1, Math.ceil((s.absoluteExpiresAt.getTime() - Date.now()) / 1000));
      const inp = { idUser: buyer.idUser, plainToken: ref, durationSeconds: ttl };
      const c = await auth.createRememberToken.execute(inp);
      const fid = c.familyId ?? undefined;
      setCk(res, rt, s.id, s.leaseId, buyer.idUser, Role.USER, s.absoluteExpiresAt, fid, ref);
      const { allocatedAt, idleExpiresAt, absoluteExpiresAt } = s;
      res
        .status(201)
        .json(fmt(buyer, Role.USER, { allocatedAt, idleExpiresAt, absoluteExpiresAt }));
    } catch (error) {
      if (alloc) await relSlot(rt, alloc.id, alloc.leaseId);
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rt = reqRt(res);
    if (!rt) return;
    const { sandbox } = req;
    const uid = req.user?.userId;
    const role = req.user?.role;
    if (!sandbox || uid === undefined || role === undefined)
      return fail(res, 401, 'Demo sandbox session invalid or expired');
    if (!ses.isAllowedDemoRole(role))
      return fail(res, 403, 'Demo sandbox is restricted to Buyer and Staff roles');
    try {
      const account = await rt.repositories.getUserRepository(sandbox.slotId).findById(uid);
      if (!account || Number(account.idRole) !== Number(role))
        return fail(res, 401, 'Demo sandbox session invalid or expired');
      const { idleExpiresAt, absoluteExpiresAt } = sandbox;
      res.status(200).json(fmt(account, role, { idleExpiresAt, absoluteExpiresAt }));
    } catch (error) {
      next(error);
    }
  };

  switchRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rt = reqRt(res);
    if (!rt) return;
    const { sandbox } = req;
    if (!sandbox || !req.user) return fail(res, 401, 'Demo sandbox session invalid or expired');
    const rawRole = typeof req.body?.role === 'string' ? req.body.role.trim().toUpperCase() : '';
    if (rawRole === 'ADMIN') return fail(res, 403, 'ADMIN role is not permitted in demo sandbox');
    if (rawRole !== 'USER' && rawRole !== 'STAFF') {
      return fail(res, 400, 'Invalid demo role. Allowed roles: USER, STAFF');
    }
    const targetRole: ses.AllowedDemoRole = rawRole === 'STAFF' ? Role.STAFF : Role.USER;
    const targetUserId = targetRole === Role.STAFF ? STAFF_ID : BUYER_ID;
    try {
      const account = await rt.repositories
        .getUserRepository(sandbox.slotId)
        .findById(targetUserId);
      if (!account || Number(account.idRole) !== Number(targetRole)) {
        return fail(res, 503, 'Demo sandbox synthetic account unavailable');
      }
      const { slotId, leaseId, idleExpiresAt, absoluteExpiresAt } = sandbox;
      if (!absoluteExpiresAt) return fail(res, 401, 'Demo sandbox session invalid or expired');
      if (req.user.userId === account.idUser && req.user.role === targetRole) {
        setCk(
          res,
          rt,
          slotId,
          leaseId,
          account.idUser,
          targetRole,
          absoluteExpiresAt,
          sandbox.familyId,
        );
        res.status(200).json(fmt(account, targetRole, { idleExpiresAt, absoluteExpiresAt }));
        return;
      }
      const auth = createDemoSandboxAuthUseCases(rt.repositories, slotId, authDeps);
      if (sandbox.familyId) {
        await auth.revoke.execute(sandbox.familyId).catch((err: unknown) => {
          logger.warn({ slotId, err }, 'Demo sandbox prior role family revoke failed');
        });
      }
      const cl = { userId: account.idUser, slotId, leaseId, role: targetRole };
      const ref = ses.signDemoSandboxRefreshToken(cl, rt.jwtSecret, absoluteExpiresAt);
      const ttl = Math.max(1, Math.ceil((absoluteExpiresAt.getTime() - Date.now()) / 1000));
      const created = await auth.createRememberToken.execute({
        idUser: account.idUser,
        plainToken: ref,
        durationSeconds: ttl,
      });
      const fid = created.familyId ?? undefined;
      setCk(res, rt, slotId, leaseId, account.idUser, targetRole, absoluteExpiresAt, fid, ref);
      res.status(200).json(fmt(account, targetRole, { idleExpiresAt, absoluteExpiresAt }));
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rt = reqRt(res);
    if (!rt) return;
    const raw = req.cookies?.[ck.DEMO_REFRESH_COOKIE];
    const p = typeof raw === 'string' ? ses.verifyDemoSandboxRefreshToken(raw, rt.jwtSecret) : null;
    if (!p) return fail(res, 401, 'Demo sandbox session expired', true);
    if (!ses.isAllowedDemoRole(p.role))
      return fail(res, 403, 'Demo sandbox is restricted to Buyer and Staff roles', true);
    try {
      const l = await ses.validateActiveSandboxLease(rt, p);
      if (!l) return fail(res, 401, 'Demo sandbox lease invalid or expired', true);
      const auth = createDemoSandboxAuthUseCases(rt.repositories, l.slotId, authDeps);
      const cl = { userId: p.userId, slotId: l.slotId, leaseId: l.leaseId, role: p.role };
      const nextTok = ses.signDemoSandboxRefreshToken(cl, rt.jwtSecret, l.absoluteExpiresAt);
      const r = await auth.refresh.execute({ presentedPlainToken: raw, newPlainToken: nextTok });
      if (r.outcome === 'rejected' || r.outcome === 'reuse-detected')
        return fail(res, 401, 'Demo sandbox session expired', true);
      if (Number(r.user.idRole) !== Number(p.role))
        return fail(res, 403, 'Demo sandbox is restricted to Buyer and Staff roles', true);
      const ref = r.outcome === 'rotated' ? nextTok : undefined;
      setCk(
        res,
        rt,
        l.slotId,
        l.leaseId,
        r.user.idUser,
        p.role,
        l.absoluteExpiresAt,
        r.familyId,
        ref,
      );
      const { idleExpiresAt, absoluteExpiresAt } = l;
      res.status(200).json(fmt(r.user, p.role, { idleExpiresAt, absoluteExpiresAt }));
    } catch (error) {
      next(error);
    }
  };

  destroy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rt = reqRt(res);
    if (!rt) return;
    const { sandbox } = req;
    if (!sandbox) return fail(res, 401, 'Demo sandbox session invalid or expired');
    try {
      try {
        const auth = createDemoSandboxAuthUseCases(rt.repositories, sandbox.slotId, authDeps);
        if (sandbox.familyId) {
          await auth.revoke.execute(sandbox.familyId);
        } else {
          const raw = req.cookies?.[ck.DEMO_REFRESH_COOKIE];
          if (typeof raw === 'string' && raw.length > 0) await auth.revoke.revokeByToken(raw);
        }
      } catch (err) {
        logger.warn({ slotId: sandbox.slotId, err }, 'Demo sandbox token revoke failed');
      }
      const rel = new ReleaseDemoSandboxLeaseUseCase(rt.slotRepository);
      await rel.execute(sandbox.slotId, sandbox.leaseId);
      clearCk(res);
      res.sendStatus(204);
    } catch (error) {
      clearCk(res);
      next(error);
    }
  };
}
