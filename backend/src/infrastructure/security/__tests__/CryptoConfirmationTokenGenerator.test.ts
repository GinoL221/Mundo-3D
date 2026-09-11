import { CryptoConfirmationTokenGenerator } from '../CryptoConfirmationTokenGenerator';
import { Sha256TokenHasher } from '../Sha256TokenHasher';

describe('email-confirmation security primitives', () => {
  it('generates a base64url token from 32 cryptographically random bytes', () => {
    const token = new CryptoConfirmationTokenGenerator().generate();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('hashes plaintext tokens as lowercase SHA-256 hexadecimal', () => {
    expect(new Sha256TokenHasher().hash('confirmation-token')).toBe(
      '23a0f8a5d44eb66f9f082c737258aaf003ccf023127f695078f39fd7f57cd2e6',
    );
  });
});
