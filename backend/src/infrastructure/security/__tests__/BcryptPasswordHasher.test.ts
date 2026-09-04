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

    it('costs about what a real comparison costs', async () => {
      const hashed = await hasher.hash('some password');

      const realStartedAt = process.hrtime.bigint();
      await hasher.compare('some password', hashed);
      const realMs = Number(process.hrtime.bigint() - realStartedAt) / 1_000_000;

      const decoyStartedAt = process.hrtime.bigint();
      await hasher.compareAgainstDecoy('some password');
      const decoyMs = Number(process.hrtime.bigint() - decoyStartedAt) / 1_000_000;

      // Same cost factor, so the same order of magnitude. Deliberately loose:
      // this catches a decoy generated at a lower cost, which is the
      // regression that matters, without pinning a ratio that scheduling noise
      // would break.
      expect(decoyMs).toBeGreaterThan(realMs / 3);
      expect(decoyMs).toBeLessThan(realMs * 3);
    });
  });
});
