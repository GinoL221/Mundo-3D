const TEST_SECRET = 'test-only-jwt-secret-not-for-production';

// An HS256 secret is the entire barrier between a session token and an
// offline brute force, and "is it set?" is not a barrier: a 4-character
// JWT_SECRET used to boot fine and sign every session in the deploy. 32
// characters is the floor, checked at read time so a weak value fails the
// process rather than quietly protecting nothing. Kept in step with
// CookieSecret.ts, which mirrors this file.
const MIN_SECRET_LENGTH = 32;

// NODE_ENV alone is not enough to unlock TEST_SECRET: it is committed to this
// repository, so any process using it signs tokens anyone can forge.
// JEST_WORKER_ID is set by Jest itself and cannot come from a deploy config,
// which makes "actually running under Jest" the real condition. Every other
// context — including the e2e suite's real server, which sets NODE_ENV=test —
// must supply its own JWT_SECRET.
function isRunningUnderJest(): boolean {
  return process.env.NODE_ENV === 'test' && Boolean(process.env.JEST_WORKER_ID);
}

export function getJwtSecret(): string {
  if (isRunningUnderJest()) {
    return TEST_SECRET;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required but was not set. ' +
      'The application cannot start without it.'
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long, ` +
      `but the value provided is ${secret.length}. ` +
      'The application cannot start with a weak signing secret.'
    );
  }

  return secret;
}
