/**
 * REAL-DATABASE integration test — NOT mocked.
 *
 * Scope: `SequelizeRememberTokenRepository`'s rotation operations (HIGH-1
 * PR1, design.md D1/D2/D7) against a real MySQL/MariaDB — proving the two
 * riskiest assumptions the whole rotation design rests on, which
 * `SequelizeRememberTokenRepository.test.ts`'s mocked call-shape assertions
 * cannot:
 *
 * - `claimRotation`'s conditional UPDATE is the actual concurrency gate
 *   (design.md D1): two concurrent callers racing the SAME row must produce
 *   exactly one `true` (claimed) — InnoDB semi-consistent read re-evaluating
 *   `superseded_at IS NULL` after the winner's transaction commits, not
 *   blocking forever and not a lost update.
 * - `reapFamily` bounds a family's row count and `family_id` is populated
 *   on every row created by `create` (login) or `insertSuccessor` (rotation).
 *
 * Excluded from the default `npm test` run (jest.config.js's
 * `testPathIgnorePatterns`); only runs via `npm run test:integration`,
 * which requires a reachable MySQL/MariaDB (`DB_HOST`/`DB_USER`/`DB_PASS`
 * env vars, see `database/config/config.js`).
 *
 * Retention/reuse-detection cases (below the original HIGH-1 PR1 coverage)
 * additionally prove: a row superseded well within the new 24h cutoff
 * survives (retention decoupled from the 30s grace window, design.md D1);
 * a row past the cutoff is still reaped on a real rotation; `revokeFamily`'s
 * effect round-trips through `findByHash`, the exact read path
 * `RefreshSessionUseCase` uses to detect a revoked row (design.md D2 row 2);
 * `revokeFamily` racing a same-family rotation resolves without partial
 * state (design.md D5); and the family accumulates N+1 rows across N
 * in-cutoff rotations rather than staying pinned near 2 (design.md D7's
 * storage-bound claim).
 */
import crypto from 'crypto';
import { Transaction } from 'sequelize';
import { SequelizeRememberTokenRepository } from '../SequelizeRememberTokenRepository';
import { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import {
  bootstrapTestDatabase,
  closeTestDatabase,
  seedTestUser,
  deleteTestUser,
  getTestDb,
} from '../../../__tests__/helpers/testDb';

jest.setTimeout(30000);

const db = getTestDb();

async function seedCurrentToken(idUser: number, familyId: string, tokenHash: string, expiryDate: Date): Promise<number> {
  const row = await db.RememberToken.create({
    idUser,
    tokenHash,
    expiryDate,
    familyId,
    createdAt: new Date(),
  });
  return row.idRememberToken;
}

async function countFamilyRows(familyId: string): Promise<number> {
  return db.RememberToken.count({ where: { familyId } });
}

async function familyRows(familyId: string): Promise<Array<{ tokenHash: string; familyId: string | null }>> {
  const rows = await db.RememberToken.findAll({ where: { familyId } });
  return rows.map((row: { tokenHash: string; familyId: string | null }) => ({
    tokenHash: row.tokenHash,
    familyId: row.familyId,
  }));
}

function asTx(transaction: Transaction): TransactionContext {
  return transaction as unknown as TransactionContext;
}

/**
 * Rewinds a row's `superseded_at` by `secondsAgo`, computed by the DATABASE
 * (`NOW() - INTERVAL ... SECOND`), never by a Node `Date`. Simulates "this
 * row was superseded a while ago" without a real sleep — the same server-
 * clock discipline `claimRotation`/`reapFamily` themselves rely on (see
 * `SequelizeRememberTokenRepository.reapFamily`'s header comment).
 */
async function rewindSupersededAt(tokenHash: string, secondsAgo: number): Promise<void> {
  await db.sequelize.query(
    'UPDATE `RememberToken` SET `superseded_at` = NOW() - INTERVAL :secondsAgo SECOND WHERE `token_hash` = :tokenHash',
    { replacements: { secondsAgo, tokenHash } }
  );
}

describe('SequelizeRememberTokenRepository — real DB rotation', () => {
  const repository = new SequelizeRememberTokenRepository();
  let userId: number;

  beforeAll(async () => {
    await bootstrapTestDatabase();
    userId = await seedTestUser();
  });

  afterAll(async () => {
    await deleteTestUser(userId);
    await closeTestDatabase();
  });

  describe('claimRotation — real concurrency', () => {
    it('lets exactly one of two concurrent claims against the same current row succeed', async () => {
      const familyId = crypto.randomUUID();
      const currentHash = `current-${crypto.randomUUID()}`;
      const expiry = new Date(Date.now() + 3600 * 1000);
      await seedCurrentToken(userId, familyId, currentHash, expiry);

      // Two independent DB transactions racing the SAME conditional UPDATE
      // against the SAME row — real concurrency, not sequential mocked
      // calls. Each wraps its own `db.sequelize.transaction()` so the
      // implicit commit fires as soon as its callback resolves, matching
      // how `SequelizeUnitOfWork.runInTransaction` is used in production.
      const claim = (successorHash: string) =>
        db.sequelize.transaction((transaction: Transaction) =>
          repository.claimRotation({
            presentedHash: currentHash,
            successorHash,
            tx: asTx(transaction),
          })
        );

      const [resultA, resultB] = await Promise.all([
        claim(`successor-a-${crypto.randomUUID()}`),
        claim(`successor-b-${crypto.randomUUID()}`),
      ]);

      // Exactly one winner — never both (double-claim) and never neither
      // (both losing would mean the UPDATE never actually matched the row).
      expect([resultA, resultB].filter(Boolean)).toHaveLength(1);

      const [[updatedRow]] = await db.sequelize.query(
        'SELECT `successor_hash`, `superseded_at` FROM `RememberToken` WHERE `token_hash` = :hash',
        { replacements: { hash: currentHash } }
      );
      // The row was superseded exactly once, by whichever successor hash
      // the winner presented — not both, not neither.
      expect(updatedRow.superseded_at).not.toBeNull();
      expect(['successor-a', 'successor-b'].some((prefix) => updatedRow.successor_hash.startsWith(prefix))).toBe(
        true
      );
    });

    it('rejects a second claim once the row is already superseded (loser re-reads a fresh, no-longer-current row)', async () => {
      const familyId = crypto.randomUUID();
      const currentHash = `current-${crypto.randomUUID()}`;
      const expiry = new Date(Date.now() + 3600 * 1000);
      await seedCurrentToken(userId, familyId, currentHash, expiry);

      const firstClaim = await db.sequelize.transaction((transaction: Transaction) =>
        repository.claimRotation({
          presentedHash: currentHash,
          successorHash: `successor-1-${crypto.randomUUID()}`,
          tx: asTx(transaction),
        })
      );
      expect(firstClaim).toBe(true);

      const secondClaim = await db.sequelize.transaction((transaction: Transaction) =>
        repository.claimRotation({
          presentedHash: currentHash,
          successorHash: `successor-2-${crypto.randomUUID()}`,
          tx: asTx(transaction),
        })
      );
      expect(secondClaim).toBe(false);
    });
  });

  describe('reapFamily and family_id population', () => {
    it('populates family_id on every row created by login (create) and by rotation (insertSuccessor), and reaping bounds the family size', async () => {
      const familyId = crypto.randomUUID();
      const expiry = new Date(Date.now() + 3600 * 1000);

      // "Login": the first row in the family, via the same `create()` path
      // `CreateRememberTokenUseCase` calls.
      const firstHash = `login-${crypto.randomUUID()}`;
      const firstEntity = await repository.create({
        idUser: userId,
        tokenHash: firstHash,
        expiryDate: expiry,
        familyId,
      } as any);
      expect(firstEntity.familyId).toBe(familyId);

      // Two successive rotations, each: claim -> insertSuccessor -> reap
      // with graceSeconds=0 so a just-superseded row is immediately
      // eligible — avoids a real 30s sleep in this test while still
      // proving the exact same conditional-DELETE code path `reapFamily`
      // uses in production (design.md D7).
      let currentHash = firstHash;
      for (let i = 0; i < 2; i += 1) {
        const successorHash = `rotation-${i}-${crypto.randomUUID()}`;
        await db.sequelize.transaction(async (transaction: Transaction) => {
          const tx = asTx(transaction);
          const claimed = await repository.claimRotation({ presentedHash: currentHash, successorHash, tx });
          expect(claimed).toBe(true);

          const successor = await repository.insertSuccessor(
            {
              idUser: userId,
              tokenHash: successorHash,
              expiryDate: expiry,
              familyId,
            } as any,
            tx
          );
          expect(successor.familyId).toBe(familyId);

          await repository.reapFamily(familyId, 0, tx);
        });
        currentHash = successorHash;
      }

      const rows = await familyRows(familyId);
      // Every remaining row in the family carries the shared family_id
      // (remember-token-store spec: "Family id is populated on every row").
      for (const row of rows) {
        expect(row.familyId).toBe(familyId);
      }
      // Reaping already-past-grace rows on each rotation keeps the family
      // small — well within the ~2-row steady state design.md D7 describes,
      // never the unbounded growth a table with no retention would show.
      const finalCount = await countFamilyRows(familyId);
      expect(finalCount).toBeLessThanOrEqual(2);
      expect(finalCount).toBeGreaterThan(0);
    });

    // Regression: reapFamily compared a Node-side `new Date(...)` cutoff
    // against `superseded_at`, which claimRotation writes with the DATABASE's
    // NOW(). Two clocks, no `timezone` configured in Sequelize, so the
    // comparison was false forever and nothing was ever deleted. The
    // family-size test only bounded the count from above, so a reaper that
    // deleted NOTHING and one that worked perfectly both looked the same
    // until the count crossed the bound. This asserts the deletion directly.
    it('actually deletes a past-grace superseded row and reports how many it removed', async () => {
      const familyId = crypto.randomUUID();
      const expiry = new Date(Date.now() + 3600 * 1000);
      const presentedHash = `reap-${crypto.randomUUID()}`;
      const successorHash = `reap-successor-${crypto.randomUUID()}`;

      await seedCurrentToken(userId, familyId, presentedHash, expiry);

      const reaped = await db.sequelize.transaction(async (transaction: Transaction) => {
        const tx = asTx(transaction);
        // Supersede via the production path, so `superseded_at` carries the
        // database's own NOW() exactly as it does in a real rotation.
        await repository.claimRotation({ presentedHash, successorHash, tx });
        return repository.reapFamily(familyId, 0, tx);
      });

      expect(reaped).toBe(1);
      expect(await countFamilyRows(familyId)).toBe(0);
    });

    // PR2 task 2.21. Logout revokes the whole family, and every token in it
    // must stop working — not just the one the browser happened to hold. The
    // unit tests mock the repository, so only a real database proves the
    // UPDATE actually matches every row sharing the family_id.
    it('revokeFamily marks every unrevoked row in the family, and only that family', async () => {
      const familyId = crypto.randomUUID();
      const otherFamilyId = crypto.randomUUID();
      const expiry = new Date(Date.now() + 3600 * 1000);

      const firstHash = `revoke-a-${crypto.randomUUID()}`;
      const secondHash = `revoke-b-${crypto.randomUUID()}`;
      const bystanderHash = `revoke-other-${crypto.randomUUID()}`;
      await seedCurrentToken(userId, familyId, firstHash, expiry);
      await seedCurrentToken(userId, familyId, secondHash, expiry);
      await seedCurrentToken(userId, otherFamilyId, bystanderHash, expiry);

      const revoked = await repository.revokeFamily(familyId);

      expect(revoked).toBe(2);
      expect((await repository.findByHash(firstHash))?.revokedAt).not.toBeNull();
      expect((await repository.findByHash(secondHash))?.revokedAt).not.toBeNull();
      // A different login's family must be untouched — a logout on one device
      // cannot be allowed to end every other session.
      expect((await repository.findByHash(bystanderHash))?.revokedAt).toBeNull();
    });

    it('revokeFamily is idempotent — a second call revokes nothing further', async () => {
      const familyId = crypto.randomUUID();
      const expiry = new Date(Date.now() + 3600 * 1000);
      await seedCurrentToken(userId, familyId, `idem-${crypto.randomUUID()}`, expiry);

      expect(await repository.revokeFamily(familyId)).toBe(1);
      // The `revokedAt: null` guard in the UPDATE is what makes this 0 rather
      // than re-stamping a new timestamp over the original revocation.
      expect(await repository.revokeFamily(familyId)).toBe(0);
    });

    // A revoked token must not be claimable, or a logged-out session could be
    // rotated back into a live one.
    it('claimRotation refuses a revoked row', async () => {
      const familyId = crypto.randomUUID();
      const expiry = new Date(Date.now() + 3600 * 1000);
      const presentedHash = `revoked-claim-${crypto.randomUUID()}`;
      await seedCurrentToken(userId, familyId, presentedHash, expiry);
      await repository.revokeFamily(familyId);

      const claimed = await db.sequelize.transaction(async (transaction: Transaction) =>
        repository.claimRotation({
          presentedHash,
          successorHash: `never-${crypto.randomUUID()}`,
          tx: asTx(transaction),
        })
      );

      expect(claimed).toBe(false);
    });

    it('does not delete a row still inside its grace window', async () => {
      const familyId = crypto.randomUUID();
      const currentHash = `current-${crypto.randomUUID()}`;
      const expiry = new Date(Date.now() + 3600 * 1000);
      await seedCurrentToken(userId, familyId, currentHash, expiry);

      await db.sequelize.transaction(async (transaction: Transaction) => {
        const tx = asTx(transaction);
        const successorHash = `successor-${crypto.randomUUID()}`;
        await repository.claimRotation({ presentedHash: currentHash, successorHash, tx });
        await repository.insertSuccessor(
          { idUser: userId, tokenHash: successorHash, expiryDate: expiry, familyId } as any,
          tx
        );
        // A large graceSeconds means the just-superseded row is still
        // "in grace" and reapFamily MUST NOT delete it.
        await repository.reapFamily(familyId, 3600, tx);
      });

      const finalCount = await countFamilyRows(familyId);
      expect(finalCount).toBe(2);
    });
  });

  // refresh-token-reuse-detection: retention cutoff decoupled from grace
  // (design.md D1/D7) and the reuse-detection round trip (design.md D2/D3/D5).
  describe('retention cutoff and reuse detection', () => {
    const REAP_SECONDS = 24 * 60 * 60; // the production default (design.md D1)

    it('a row superseded at T survives at T+1h under the wider cutoff — proves the cutoff is no longer 30s', async () => {
      const familyId = crypto.randomUUID();
      const currentHash = `cutoff-survive-${crypto.randomUUID()}`;
      const expiry = new Date(Date.now() + 3600 * 1000);
      await seedCurrentToken(userId, familyId, currentHash, expiry);

      await db.sequelize.transaction(async (transaction: Transaction) => {
        const tx = asTx(transaction);
        const successorHash = `cutoff-survive-succ-${crypto.randomUUID()}`;
        await repository.claimRotation({ presentedHash: currentHash, successorHash, tx });
        await repository.insertSuccessor(
          { idUser: userId, tokenHash: successorHash, expiryDate: expiry, familyId } as any,
          tx
        );
      });

      // Rewind superseded_at to "1 hour ago", computed by the DB clock —
      // simulates T+1h without a real sleep. Under the OLD 30s cutoff this
      // row would already be gone; under the 24h cutoff it must not be.
      await rewindSupersededAt(currentHash, 3600);

      await db.sequelize.transaction(async (transaction: Transaction) =>
        repository.reapFamily(familyId, REAP_SECONDS, asTx(transaction))
      );

      const rows = await familyRows(familyId);
      expect(rows.some((row) => row.tokenHash === currentHash)).toBe(true);
      expect(await countFamilyRows(familyId)).toBe(2);
    });

    it('a row superseded past the injected cutoff IS reaped on a real rotation in that family', async () => {
      const familyId = crypto.randomUUID();
      const staleHash = `cutoff-reap-stale-${crypto.randomUUID()}`;
      const currentHash = `cutoff-reap-current-${crypto.randomUUID()}`;
      const expiry = new Date(Date.now() + 3600 * 1000);

      // A row already superseded well past the injected cutoff...
      await seedCurrentToken(userId, familyId, staleHash, expiry);
      await rewindSupersededAt(staleHash, REAP_SECONDS + 60);

      // ...and a separate current row that actually rotates in the same
      // family (reapFamily only ever runs during a rotation, design.md D7).
      await seedCurrentToken(userId, familyId, currentHash, expiry);

      await db.sequelize.transaction(async (transaction: Transaction) => {
        const tx = asTx(transaction);
        const successorHash = `cutoff-reap-succ-${crypto.randomUUID()}`;
        await repository.claimRotation({ presentedHash: currentHash, successorHash, tx });
        await repository.insertSuccessor(
          { idUser: userId, tokenHash: successorHash, expiryDate: expiry, familyId } as any,
          tx
        );
        await repository.reapFamily(familyId, REAP_SECONDS, tx);
      });

      const rows = await familyRows(familyId);
      expect(rows.some((row) => row.tokenHash === staleHash)).toBe(false);
    });

    it('detection round trip: revokeFamily on a family makes findByHash report every member revoked', async () => {
      const familyId = crypto.randomUUID();
      const supersededHash = `detect-superseded-${crypto.randomUUID()}`;
      const currentHash = `detect-current-${crypto.randomUUID()}`;
      const expiry = new Date(Date.now() + 3600 * 1000);

      await seedCurrentToken(userId, familyId, supersededHash, expiry);
      await seedCurrentToken(userId, familyId, currentHash, expiry);
      await db.sequelize.query(
        'UPDATE `RememberToken` SET `superseded_at` = NOW() - INTERVAL 60 SECOND, `successor_hash` = :h WHERE `token_hash` = :s',
        { replacements: { h: currentHash, s: supersededHash } }
      );

      const revoked = await repository.revokeFamily(familyId);
      expect(revoked).toBe(2);

      // findByHash is the exact read path RefreshSessionUseCase relies on to
      // reject row 2 ("revoked token") on any later presentation from this
      // family, including the attacker's copy.
      const supersededRow = await repository.findByHash(supersededHash);
      const currentRow = await repository.findByHash(currentHash);
      expect(supersededRow?.revokedAt).not.toBeNull();
      expect(currentRow?.revokedAt).not.toBeNull();
    });

    it('revokeFamily concurrent with a same-family rotation resolves without partial state', async () => {
      const familyId = crypto.randomUUID();
      const currentHash = `contend-current-${crypto.randomUUID()}`;
      const successorHash = `contend-succ-${crypto.randomUUID()}`;
      const expiry = new Date(Date.now() + 3600 * 1000);
      await seedCurrentToken(userId, familyId, currentHash, expiry);

      const rotate = () =>
        db.sequelize.transaction(async (transaction: Transaction) => {
          const tx = asTx(transaction);
          const claimed = await repository.claimRotation({ presentedHash: currentHash, successorHash, tx });
          if (claimed) {
            await repository.insertSuccessor(
              { idUser: userId, tokenHash: successorHash, expiryDate: expiry, familyId } as any,
              tx
            );
            await repository.reapFamily(familyId, REAP_SECONDS, tx);
          }
          return claimed;
        });

      const revoke = () => repository.revokeFamily(familyId);

      // Real concurrency, not sequential mocked calls. MySQL's deadlock
      // detector may roll one side back — that surfaces as a rejection here
      // rather than silent partial state (design.md D5: "each side is
      // individually atomic so no partial state is possible").
      const outcomes = await Promise.allSettled([rotate(), revoke()]);
      for (const outcome of outcomes) {
        if (outcome.status === 'rejected') {
          expect(outcome.reason).toBeInstanceOf(Error);
        }
      }

      // Whichever interleaving occurred, the family must never end up with
      // zero rows (nothing here is eligible for reaping — everything is
      // brand new) and never more than 2 (no duplicate-insert bug) — a
      // rotation either fully committed (2 rows) or fully rolled back (1).
      const finalCount = await countFamilyRows(familyId);
      expect(finalCount).toBeGreaterThanOrEqual(1);
      expect(finalCount).toBeLessThanOrEqual(2);

      // No row is left half-written: every surviving row still round-trips
      // through findByHash with a well-formed familyId.
      const rows = await familyRows(familyId);
      for (const row of rows) {
        expect(row.familyId).toBe(familyId);
      }
    });

    // Deviation from tasks.md (flagged by sdd-tasks, required by design.md's
    // Testing Strategy table): pins the accepted storage growth so a future
    // cutoff change is visible, contrasting with the graceSeconds=0 test
    // above whose finalCount stays <=2.
    it('storage bound: N rotations inside the cutoff leave the family with N+1 rows, not ~2', async () => {
      const familyId = crypto.randomUUID();
      const expiry = new Date(Date.now() + 3600 * 1000);
      const firstHash = `storage-${crypto.randomUUID()}`;
      await seedCurrentToken(userId, familyId, firstHash, expiry);

      const rotations = 3;
      let currentHash = firstHash;
      for (let i = 0; i < rotations; i += 1) {
        const successorHash = `storage-${i}-${crypto.randomUUID()}`;
        await db.sequelize.transaction(async (transaction: Transaction) => {
          const tx = asTx(transaction);
          const claimed = await repository.claimRotation({ presentedHash: currentHash, successorHash, tx });
          expect(claimed).toBe(true);
          await repository.insertSuccessor(
            { idUser: userId, tokenHash: successorHash, expiryDate: expiry, familyId } as any,
            tx
          );
          // The 24h production cutoff — every superseded row from this loop
          // is seconds old, so none of them is reapable yet.
          await repository.reapFamily(familyId, REAP_SECONDS, tx);
        });
        currentHash = successorHash;
      }

      const finalCount = await countFamilyRows(familyId);
      expect(finalCount).toBe(rotations + 1);
    });
  });
});
