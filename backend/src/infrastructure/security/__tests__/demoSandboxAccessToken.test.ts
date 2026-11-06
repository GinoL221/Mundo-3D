import jwt from 'jsonwebtoken';
import { accessTokenVerifyOptions } from '../jwtOptions';
import {
  issueDemoSandboxAccessToken,
  verifyDemoSandboxAccessToken,
} from '../demoSandboxAccessToken';

const secret = 'test-only-secret-not-used-in-production';
const lease = { slotId: 'slot-a', leaseId: 'lease-a' };

test('accepts a valid access token only for the validated lease and slot', () => {
  const token = issueDemoSandboxAccessToken({ userId: 7 }, lease, secret);
  expect(verifyDemoSandboxAccessToken(token, lease, secret)).toEqual({ userId: 7 });
  expect(
    verifyDemoSandboxAccessToken(token, { slotId: 'slot-a', leaseId: 'lease-b' }, secret),
  ).toBeNull();
  expect(
    verifyDemoSandboxAccessToken(token, { slotId: 'slot-b', leaseId: 'lease-a' }, secret),
  ).toBeNull();
});

test('keeps sandbox and production access tokens cryptographically separated by audience', () => {
  const token = issueDemoSandboxAccessToken({ userId: 7 }, lease, secret);
  expect(() => jwt.verify(token, secret, accessTokenVerifyOptions())).toThrow();
  const production = jwt.sign({ userId: 7, typ: 'access' }, secret, {
    algorithm: 'HS256',
    issuer: 'mundo-3d',
    audience: 'mundo-3d-api',
    expiresIn: 60,
  });
  expect(verifyDemoSandboxAccessToken(production, lease, secret)).toBeNull();
});

test('rejects invalid signatures and missing lease context', () => {
  const token = issueDemoSandboxAccessToken({ userId: 7 }, lease, secret);
  expect(verifyDemoSandboxAccessToken(token, lease, 'wrong-secret')).toBeNull();
  expect(verifyDemoSandboxAccessToken(token, { slotId: 'slot-a', leaseId: '' }, secret)).toBeNull();
});
