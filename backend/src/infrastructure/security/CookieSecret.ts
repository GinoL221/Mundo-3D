const TEST_SECRET = 'test-only-cookie-secret-not-for-production';

// Mirrors JwtSecret.ts's MIN_SECRET_LENGTH, and for the same reason: this
// value signs CSRF tokens, so a short one is guessable exactly as a short
// JWT secret is. Change one and change the other.
const MIN_SECRET_LENGTH = 32;

/**
 * Mirrors `JwtSecret.ts`'s pattern: a deterministic value in tests, and a
 * required env var everywhere else. Read lazily (only when the CSRF token
 * is actually issued/verified) so app boot never depends on it — see
 * `appConfig.test.js` ("does NOT throw error if COOKIE_SECRET is missing").
 */
// Same reasoning as JwtSecret.ts: this constant is public in the repository
// and it signs CSRF tokens, so only a real Jest process may use it.
function isRunningUnderJest(): boolean {
  return process.env.NODE_ENV === 'test' && Boolean(process.env.JEST_WORKER_ID);
}

export function getCookieSecret(): string {
  if (isRunningUnderJest()) {
    return TEST_SECRET;
  }

  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    throw new Error(
      'COOKIE_SECRET environment variable is required but was not set. ' +
        'The application cannot start without it.'
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `COOKIE_SECRET must be at least ${MIN_SECRET_LENGTH} characters long, ` +
        `but the value provided is ${secret.length}. ` +
        'The application cannot start with a weak signing secret.'
    );
  }

  return secret;
}
