// @ts-expect-error: bcryptjs does not provide native TypeScript types in all environments
import bcryptjs from 'bcryptjs';
import { BcryptPasswordHasher } from '../BcryptPasswordHasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();

  it('hashes and verifies a password', async () => {
    const hashed = await hasher.hash('correct horse battery staple');

    await expect(hasher.compare('correct horse battery staple', hashed)).resolves.toBe(true);
    await expect(hasher.compare('wrong password', hashed)).resolves.toBe(false);
  });

  describe('compareAgainstDecoy', () => {
    it('resolves without reporting a result', async () => {
      await expect(hasher.compareAgainstDecoy('anything')).resolves.toBeUndefined();
    });

    // The point of the decoy is the work, not the return. A stub that resolved
    // immediately would satisfy every other assertion here and silently
    // restore the ~90ms gap that told an attacker which emails are real.
    //
    // Asserted as a floor, never as a window: bcrypt at cost 10 takes roughly
    // 90ms on this hardware, so 15ms clears a no-op by a wide margin while
    // leaving room for a slow or loaded CI machine. An upper bound here would
    // be a flaky test, and this suite has been bitten by those before.
    it('spends real hashing work rather than returning immediately', async () => {
      const startedAt = process.hrtime.bigint();
      await hasher.compareAgainstDecoy('anything');
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      expect(elapsedMs).toBeGreaterThan(15);
    });

    it('compares the supplied plaintext against a decoy at the real hash cost', async () => {
      const plain = 'some password';
      const realHash = await hasher.hash(plain);
      const compareSpy = jest.spyOn(bcryptjs, 'compare');

      try {
        await hasher.compareAgainstDecoy(plain);

        expect(compareSpy).toHaveBeenCalledTimes(1);
        const [comparedPlain, decoyHash] = compareSpy.mock.calls[0];
        expect(comparedPlain).toBe(plain);
        expect(decoyHash).toMatch(/^\$2[aby]\$\d{2}\$/);
        expect(bcryptjs.getRounds(decoyHash)).toBe(bcryptjs.getRounds(realHash));
      } finally {
        jest.restoreAllMocks();
      }
    });

    it('rejects lower-cost hashes and missing comparisons in its operation oracle', async () => {
      const plain = 'some password';
      const realHash = await hasher.hash(plain);
      const validHash = await hasher.hash(plain);
      const realRounds = bcryptjs.getRounds(realHash);
      const validateOperation = (calls: Array<[string, string]>) => {
        expect(calls).toHaveLength(1);
        const [comparedPlain, comparedHash] = calls[0];
        expect(comparedPlain).toBe(plain);
        expect(comparedHash).toMatch(/^\$2[aby]\$\d{2}\$/);
        expect(bcryptjs.getRounds(comparedHash)).toBe(realRounds);
      };

      try {
        expect(() => validateOperation([])).toThrow();
        const lowerCostHash = await bcryptjs.hash(plain, realRounds - 1);
        expect(() => validateOperation([[plain, lowerCostHash]])).toThrow();
        expect(() => validateOperation([[plain, validHash]])).not.toThrow();
      } finally {
        jest.restoreAllMocks();
      }
    });
  });
});
