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
 * HONESTY NOTE (see apply-progress.md): this file was NOT executed during
 * this apply batch — no local MySQL was reachable (host port 3306 held by
 * an unrelated local MySQL this session had no credentials for). It is
 * written to the same conventions as the sibling
 * `SequelizeProductRepository.integration.test.ts` real-concurrency test
 * (`adjustStock`) and will run for the first time in CI.
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
});
