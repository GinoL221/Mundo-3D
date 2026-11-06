import jwt from 'jsonwebtoken';
import { JWT_ALGORITHM, JWT_ISSUER } from './jwtOptions';

const audience = 'mundo-3d-sandbox';
const lifetimeSeconds = 900;

interface LeaseContext {
  slotId: string;
  leaseId: string;
}
interface Principal {
  userId: number;
}

/** An isolated token contract. Callers must first validate that the lease is active. */
export function issueDemoSandboxAccessToken(
  principal: Principal,
  lease: LeaseContext,
  secret: string,
): string {
  if (
    !Number.isSafeInteger(principal.userId) ||
    principal.userId <= 0 ||
    !lease.slotId.trim() ||
    !lease.leaseId.trim() ||
    !secret
  ) {
    throw new Error('Invalid sandbox access token input');
  }
  return jwt.sign(
    {
      userId: principal.userId,
      slotId: lease.slotId,
      leaseId: lease.leaseId,
      typ: 'sandbox-access',
    },
    secret,
    {
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience,
      expiresIn: lifetimeSeconds,
    },
  );
}

/** The supplied context must come from fresh, trusted lease validation, never directly from a header. */
export function verifyDemoSandboxAccessToken(
  token: string,
  lease: LeaseContext,
  secret: string,
): Principal | null {
  if (!lease.slotId.trim() || !lease.leaseId.trim() || !secret) return null;
  try {
    const claims = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience,
    });
    if (
      typeof claims === 'string' ||
      claims.typ !== 'sandbox-access' ||
      claims.slotId !== lease.slotId ||
      claims.leaseId !== lease.leaseId ||
      !Number.isSafeInteger(claims.userId) ||
      claims.userId <= 0 ||
      typeof claims.exp !== 'number'
    )
      return null;
    return { userId: claims.userId };
  } catch {
    return null;
  }
}
