import { BcryptPasswordHasher } from '../BcryptPasswordHasher';
import { Sha256TokenHasher } from '../Sha256TokenHasher';

describe('Security Adapters Integration Tests', () => {
  describe('BcryptPasswordHasher', () => {
    const hasher = new BcryptPasswordHasher();

    it('should hash a password successfully and produce a valid bcrypt hash', async () => {
      const password = 'mySecretPassword123';
      const hash = await hasher.hash(password);

      expect(hash).toBeDefined();
      expect(hash).not.toEqual(password);
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
    });

    it('should verify correct password match', async () => {
      const password = 'mySecretPassword123';
      const hash = await hasher.hash(password);

      const isMatch = await hasher.compare(password, hash);
      expect(isMatch).toBe(true);
    });

    it('should reject incorrect password comparison', async () => {
      const password = 'mySecretPassword123';
      const wrongPassword = 'wrongPassword';
      const hash = await hasher.hash(password);

      const isMatch = await hasher.compare(wrongPassword, hash);
      expect(isMatch).toBe(false);
    });
  });

  describe('Sha256TokenHasher', () => {
    const hasher = new Sha256TokenHasher();

    it('should hash a token deterministically to a 64-character hex string', () => {
      const token = 'myPlainRememberTokenValue';
      const hash1 = hasher.hash(token);
      const hash2 = hasher.hash(token);

      expect(hash1).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(hash1)).toBe(true);
      expect(hash1).toEqual(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const token1 = 'myPlainRememberTokenValue1';
      const token2 = 'myPlainRememberTokenValue2';

      const hash1 = hasher.hash(token1);
      const hash2 = hasher.hash(token2);

      expect(hash1).not.toEqual(hash2);
    });
  });
});
