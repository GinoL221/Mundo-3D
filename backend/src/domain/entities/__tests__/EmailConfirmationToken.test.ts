import { EmailConfirmationToken } from '../EmailConfirmationToken';

describe('EmailConfirmationToken confirmation timing and delivery identity', () => {
  it.each([
    ['2026-09-10T12:34:56.000Z', '2026-09-11T12:34:56.000Z'],
    ['2024-02-29T23:59:59.000Z', '2024-03-01T23:59:59.000Z'],
  ])('creates an expiry exactly 24 hours after injected clock time %s', (createdAt, expiresAt) => {
    const now = new Date(createdAt);
    const token = EmailConfirmationToken.createPending({
      recordId: 71,
      userId: 9,
      tokenHash: 'a'.repeat(64),
      now,
    });

    expect(token.createdAt).toEqual(now);
    expect(token.expiresAt).toEqual(new Date(expiresAt));
  });

  it('uses only a stable record-id key for delivery idempotency', () => {
    const key = EmailConfirmationToken.deliveryIdempotencyKey(71);

    expect(key).toBe('email-confirmation-token:71');
    expect(key).not.toMatch(
      /customer@example\.com|opaque-token|confirm-email|https%3A%2F%2Fshop\.example\.com/i,
    );
  });

  it('does not expose plaintext, recipient, or URL fields from token state', () => {
    const token = EmailConfirmationToken.createPending({
      recordId: 71,
      userId: 9,
      tokenHash: 'a'.repeat(64),
      now: new Date('2026-09-10T12:34:56.000Z'),
    });

    expect(JSON.stringify(token)).not.toMatch(/opaque-token|customer@example\.com|confirm-email/i);
  });
});
