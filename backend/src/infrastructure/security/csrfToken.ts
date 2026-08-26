import crypto from 'crypto';
import { getCookieSecret } from './CookieSecret';

type UserIdLike = number | string;

/**
 * Signed double-submit CSRF token (design.md "Decision: CSRF = signed
 * double-submit cookie"): `<random>.<HMAC-SHA256(COOKIE_SECRET, userId + "." + random)>`.
 * Bound to `userId` so a cookie planted by a sibling host cannot forge a
 * valid signature without `COOKIE_SECRET`.
 */
export function issueCsrfToken(userId: UserIdLike): string {
  const random = crypto.randomBytes(24).toString('base64url');
  const signature = signCsrfPayload(userId, random);
  return `${random}.${signature}`;
}

export function verifyCsrfToken(
  token: string | undefined | null,
  userId: UserIdLike | undefined | null
): boolean {
  if (!token || userId === undefined || userId === null) {
    return false;
  }

  const separatorIndex = token.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return false;
  }

  const random = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = signCsrfPayload(userId, random);

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

function signCsrfPayload(userId: UserIdLike, random: string): string {
  return crypto.createHmac('sha256', getCookieSecret()).update(`${userId}.${random}`).digest('base64url');
}
