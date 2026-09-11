import { loadEmailConfirmationConfig } from '../emailConfirmationConfig';

describe('email confirmation public origin configuration', () => {
  it('accepts the deployment-owned PUBLIC_APP_URL and builds an absolute confirmation URL', () => {
    const config = loadEmailConfirmationConfig({
      PUBLIC_APP_URL: 'https://shop.example.com',
    });

    expect(config.publicOrigin.buildConfirmationUrl('opaque-token')).toBe(
      'https://shop.example.com/confirm-email?token=opaque-token',
    );
    expect(config.publicOrigin.buildConfirmationUrl('token with+/=?#characters')).toBe(
      'https://shop.example.com/confirm-email?token=token+with%2B%2F%3D%3F%23characters',
    );
  });

  it.each([
    'https://user:pass@shop.example.com',
    'https://shop.example.com/path',
    'https://shop.example.com/?preview=true',
    'https://shop.example.com/#fragment',
    'http://shop.example.com',
    'not an absolute URL',
    'ftp://shop.example.com',
    'https://shop.example.com/%2Fadmin',
    'http://localhost.evil',
  ])('rejects an untrusted PUBLIC_APP_URL: %s', (PUBLIC_APP_URL) => {
    expect(() => loadEmailConfirmationConfig({ PUBLIC_APP_URL })).toThrow();
  });

  it('allows an HTTP localhost origin for the local demo only', () => {
    const config = loadEmailConfirmationConfig({ PUBLIC_APP_URL: 'http://localhost:4321' });

    expect(config.publicOrigin.buildConfirmationUrl('opaque-token')).toBe(
      'http://localhost:4321/confirm-email?token=opaque-token',
    );
  });
});
