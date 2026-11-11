/**
 * Parses a positive integer from environment configuration strings.
 * Falling back to the provided default prevents NaN values which, when passed to
 * rate-limiters (such as express-rate-limit), silently disable limits.
 */
export function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw || typeof raw !== 'string') {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
