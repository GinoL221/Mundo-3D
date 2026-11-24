import crypto from 'crypto';
import { DEMO_SANDBOX_MIN_JWT_SECRET_LENGTH } from '../database/DemoSandboxConnections';

export interface DemoSandboxCsrfScope {
  slotId: string;
  leaseId: string;
  userId: number | string;
}

function hasValidScope(
  scope: DemoSandboxCsrfScope | undefined | null,
): scope is DemoSandboxCsrfScope {
  if (!scope) return false;
  if (!scope.slotId.trim() || !scope.leaseId.trim()) return false;
  if (typeof scope.userId === 'number') return Number.isFinite(scope.userId);
  return scope.userId.trim().length > 0;
}

function signDemoCsrfPayload(scope: DemoSandboxCsrfScope, random: string, secret: string): string {
  const payload = `demo-csrf:${JSON.stringify([
    scope.slotId,
    scope.leaseId,
    String(scope.userId),
    random,
  ])}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueDemoSandboxCsrfToken(scope: DemoSandboxCsrfScope, secret: string): string {
  if (!secret || secret.trim().length < DEMO_SANDBOX_MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `Demo sandbox CSRF secret must be at least ${DEMO_SANDBOX_MIN_JWT_SECRET_LENGTH} characters long`,
    );
  }
  if (!hasValidScope(scope)) {
    throw new Error('Demo sandbox CSRF scope requires slotId, leaseId, and userId');
  }
  const random = crypto.randomBytes(24).toString('base64url');
  const signature = signDemoCsrfPayload(scope, random, secret);
  return `${random}.${signature}`;
}

export function verifyDemoSandboxCsrfToken(
  token: string | undefined | null,
  scope: DemoSandboxCsrfScope | undefined | null,
  secret: string | undefined | null,
): boolean {
  if (
    !token ||
    !secret ||
    secret.trim().length < DEMO_SANDBOX_MIN_JWT_SECRET_LENGTH ||
    !hasValidScope(scope)
  ) {
    return false;
  }

  const separatorIndex = token.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return false;
  }

  const random = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = signDemoCsrfPayload(scope, random, secret);

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}
