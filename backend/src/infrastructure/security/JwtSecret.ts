const TEST_SECRET = 'test-only-jwt-secret-not-for-production';

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

  return secret;
}
