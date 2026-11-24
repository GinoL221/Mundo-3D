import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ValidateDemoSandboxLeaseUseCase } from '../../application/use-cases/ValidateDemoSandboxLeaseUseCase';
import { Role } from '../../domain/Role';
import * as rtMod from '../maintenance/demoSandboxRuntime';
import * as ck from '../security/demoSandboxCookies';
import { verifyDemoSandboxCsrfToken } from '../security/demoSandboxCsrfToken';
import { JWT_ALGORITHM, JWT_ISSUER } from '../security/jwtOptions';

const ACCESS_AUD = 'mundo-3d-sandbox';
const REFRESH_AUD = 'mundo-3d-sandbox-refresh';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const fail = (res: Response, status: number, body: Record<string, string>): void => {
  res.status(status).json(body);
};

export interface DemoSandboxTokenPayload {
  userId: number;
  slotId: string;
  leaseId: string;
  role: Role;
  familyId?: string;
}
type MaybeTok = string | undefined | null;

function verifyToken(
  token: MaybeTok,
  secret: string,
  audience: string,
  typ: 'sandbox-access' | 'sandbox-refresh',
): DemoSandboxTokenPayload | null {
  if (!token || !secret) return null;
  try {
    const opts = { algorithms: [JWT_ALGORITHM], issuer: JWT_ISSUER, audience };
    const c = jwt.verify(token, secret, opts);
    if (typeof c === 'string' || c.typ !== typ) return null;
    if (!Number.isSafeInteger(c.userId) || c.userId <= 0) return null;
    if (!nonEmpty(c.slotId) || !nonEmpty(c.leaseId)) return null;
    if (typeof c.role !== 'number' || typeof c.exp !== 'number') return null;
    if (c.familyId !== undefined && !nonEmpty(c.familyId)) return null;
    const base = { userId: c.userId, slotId: c.slotId, leaseId: c.leaseId, role: c.role as Role };
    return c.familyId ? { ...base, familyId: c.familyId } : base;
  } catch {
    return null;
  }
}

export const signDemoSandboxAccessToken = (p: DemoSandboxTokenPayload, secret: string): string =>
  jwt.sign({ ...p, typ: 'sandbox-access' }, secret, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: ACCESS_AUD,
    expiresIn: ck.DEMO_SANDBOX_ACCESS_TTL_SECONDS,
  });

export const verifyDemoSandboxAccessToken = (t: MaybeTok, s: string) =>
  verifyToken(t, s, ACCESS_AUD, 'sandbox-access');

export const signDemoSandboxRefreshToken = (
  p: DemoSandboxTokenPayload,
  secret: string,
  expiresAt: Date,
): string => {
  const nonce = crypto.randomBytes(32).toString('hex');
  const exp = Math.floor(expiresAt.getTime() / 1000);
  const opts = { algorithm: JWT_ALGORITHM, issuer: JWT_ISSUER, audience: REFRESH_AUD };
  return jwt.sign({ ...p, typ: 'sandbox-refresh', nonce, exp }, secret, opts);
};

export const verifyDemoSandboxRefreshToken = (t: MaybeTok, s: string) =>
  verifyToken(t, s, REFRESH_AUD, 'sandbox-refresh');

export async function validateActiveSandboxLease(
  rt: rtMod.DemoSandboxRuntimeHandle,
  p: Pick<DemoSandboxTokenPayload, 'slotId' | 'leaseId'>,
) {
  const clk = { now: () => new Date() };
  const s = await new ValidateDemoSandboxLeaseUseCase(
    rt.slotRepository,
    rt.leasePolicy,
    clk,
  ).execute(p.leaseId);
  if (!s || s.status !== 'leased' || s.id !== p.slotId || s.leaseId !== p.leaseId) return null;
  if (!s.idleExpiresAt || !s.absoluteExpiresAt) return null;
  return {
    slotId: s.id,
    leaseId: s.leaseId,
    idleExpiresAt: s.idleExpiresAt,
    absoluteExpiresAt: s.absoluteExpiresAt,
  };
}

export function requireDemoSandboxEnabled(_req: Request, res: Response, next: NextFunction): void {
  if (!rtMod.getActiveDemoSandboxRuntime()) return fail(res, 404, { message: 'Not found' });
  next();
}

export async function demoSandboxAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rt = rtMod.getActiveDemoSandboxRuntime();
  if (!rt) return fail(res, 404, { message: 'Not found' });
  const raw = req.cookies?.[ck.DEMO_AUTH_COOKIE];
  const payload = typeof raw === 'string' ? verifyDemoSandboxAccessToken(raw, rt.jwtSecret) : null;
  if (!payload) return fail(res, 401, { error: 'Demo sandbox session invalid or expired' });
  if (payload.role !== Role.USER) {
    return fail(res, 403, { error: 'Demo sandbox is restricted to Buyer role' });
  }
  try {
    const lease = await validateActiveSandboxLease(rt, payload);
    if (!lease) return fail(res, 401, { error: 'Demo sandbox lease invalid or expired' });
    req.sandbox = payload.familyId ? { ...lease, familyId: payload.familyId } : lease;
    req.user = { userId: payload.userId, role: Role.USER };
    next();
  } catch (error) {
    next(error);
  }
}

export function demoSandboxCsrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  const rt = rtMod.getActiveDemoSandboxRuntime();
  if (!rt) return fail(res, 404, { message: 'Not found' });
  const hdr = req.headers['x-csrf-token'];
  const cki = req.cookies?.[ck.DEMO_CSRF_COOKIE];
  const { sandbox } = req;
  const userId = req.user?.userId;
  const err = { error: 'Invalid demo sandbox CSRF token' };
  if (typeof hdr !== 'string' || typeof cki !== 'string' || !sandbox || userId === undefined) {
    return fail(res, 403, err);
  }
  const hBuf = Buffer.from(hdr);
  const cBuf = Buffer.from(cki);
  const ctx = { slotId: sandbox.slotId, leaseId: sandbox.leaseId, userId };
  const ok =
    hBuf.length === cBuf.length &&
    crypto.timingSafeEqual(hBuf, cBuf) &&
    verifyDemoSandboxCsrfToken(hdr, ctx, rt.jwtSecret);
  if (!ok) return fail(res, 403, err);
  next();
}
