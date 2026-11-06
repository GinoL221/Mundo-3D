import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import type { RefreshSessionResult } from '../../application/use-cases/RefreshSessionUseCase';
import { JWT_ALGORITHM, JWT_ISSUER } from './jwtOptions';

const audience = 'mundo-3d-sandbox-refresh';
interface LeaseContext {
  slotId: string;
  leaseId: string;
}
const validContext = (lease: LeaseContext) =>
  typeof lease?.slotId === 'string' &&
  lease.slotId.trim().length > 0 &&
  typeof lease?.leaseId === 'string' &&
  lease.leaseId.trim().length > 0;
const validPlaintext = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

/** Isolated credential: callers must supply a freshly validated server-side lease. */
export function issueDemoSandboxRefreshToken(
  lease: LeaseContext,
  secret: string,
  expiresAt: Date,
): string {
  const exp = Math.floor(expiresAt.getTime() / 1000);
  if (
    !validContext(lease) ||
    !secret ||
    !Number.isSafeInteger(exp) ||
    exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error('Invalid sandbox refresh token input');
  }
  return jwt.sign(
    {
      typ: 'sandbox-refresh',
      slotId: lease.slotId,
      leaseId: lease.leaseId,
      nonce: randomBytes(32).toString('hex'),
      exp,
    },
    secret,
    {
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience,
    },
  );
}

/** The complete signed token, not its visible nonce, is the refresh credential. */
export function unwrapDemoSandboxRefreshToken(
  token: string,
  lease: LeaseContext,
  secret: string,
): string | null {
  if (!validContext(lease) || !secret) return null;
  try {
    const claims = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience,
    });
    if (
      typeof claims === 'string' ||
      claims.typ !== 'sandbox-refresh' ||
      claims.slotId !== lease.slotId ||
      claims.leaseId !== lease.leaseId ||
      typeof claims.exp !== 'number' ||
      !validPlaintext(claims.nonce)
    )
      return null;
    return token;
  } catch {
    return null;
  }
}

/** Must be called with an active server-validated lease; reset/expiry fencing is not provided. */
export async function executeBoundDemoSandboxRefresh(
  token: string,
  lease: LeaseContext,
  secret: string,
  refresh: (plaintext: string) => Promise<RefreshSessionResult>,
): Promise<RefreshSessionResult> {
  const credential = unwrapDemoSandboxRefreshToken(token, lease, secret);
  return credential === null ? { outcome: 'rejected' } : refresh(credential);
}
