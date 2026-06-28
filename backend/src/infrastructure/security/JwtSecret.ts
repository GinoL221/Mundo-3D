const TEST_SECRET = 'test-only-jwt-secret-not-for-production';

export function getJwtSecret(): string {
  if (process.env.NODE_ENV === 'test') {
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
