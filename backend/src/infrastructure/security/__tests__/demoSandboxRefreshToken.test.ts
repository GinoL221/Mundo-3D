import jwt from 'jsonwebtoken';
import {
  issueDemoSandboxRefreshToken,
  unwrapDemoSandboxRefreshToken,
  executeBoundDemoSandboxRefresh,
} from '../demoSandboxRefreshToken';

const secret = 'test-only-not-a-production-secret';
const lease = { slotId: 'slot-a', leaseId: 'lease-a' };
const expiry = new Date('2099-01-01T00:00:00.000Z');

test('binds the full refresh credential without embedding a separate bearer', () => {
  const token = issueDemoSandboxRefreshToken(lease, secret, expiry);
  expect(jwt.decode(token)).not.toHaveProperty('token');
  expect(unwrapDemoSandboxRefreshToken(token, lease, secret)).toBe(token);
  expect(
    unwrapDemoSandboxRefreshToken(token, { slotId: 'slot-a', leaseId: 'lease-b' }, secret),
  ).toBeNull();
  expect(
    unwrapDemoSandboxRefreshToken(token, { slotId: 'slot-b', leaseId: 'lease-a' }, secret),
  ).toBeNull();
});

test('rejects a different lease before invoking refresh operations', async () => {
  const token = issueDemoSandboxRefreshToken(lease, secret, expiry);
  const refresh = jest.fn().mockResolvedValue({ outcome: 'rotated' });
  expect(
    await executeBoundDemoSandboxRefresh(
      token,
      { slotId: 'slot-a', leaseId: 'lease-b' },
      secret,
      refresh,
    ),
  ).toEqual({ outcome: 'rejected' });
  expect(refresh).not.toHaveBeenCalled();
  expect(await executeBoundDemoSandboxRefresh(token, lease, secret, refresh)).toEqual({
    outcome: 'rotated',
  });
  expect(refresh).toHaveBeenCalledWith(token);
});

test('issues independent credentials even with identical lease and expiry', () => {
  expect(issueDemoSandboxRefreshToken(lease, secret, expiry)).not.toBe(
    issueDemoSandboxRefreshToken(lease, secret, expiry),
  );
});

test('rejects forged or malformed credentials', () => {
  const token = issueDemoSandboxRefreshToken(lease, secret, expiry);
  expect(unwrapDemoSandboxRefreshToken(token, lease, 'different-test-secret')).toBeNull();
  expect(unwrapDemoSandboxRefreshToken('not-a-token', lease, secret)).toBeNull();
});
