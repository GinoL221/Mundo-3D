import crypto from 'crypto';
import { Transaction } from 'sequelize';
// Require keeps this RED test type-checkable while the production adapter is absent.
const {
  SequelizeEmailConfirmationTokenRepository,
} = require('../SequelizeEmailConfirmationTokenRepository');
import { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import {
  bootstrapTestDatabase,
  closeTestDatabase,
  deleteTestUser,
  getTestDb,
  seedTestUser,
} from '../../../__tests__/helpers/testDb';

jest.setTimeout(30000);

const db = getTestDb();
const asTx = (transaction: Transaction): TransactionContext =>
  transaction as unknown as TransactionContext;
const activeRows = (userId: number) =>
  db.EmailConfirmationToken.findAll({ where: { idUser: userId, activeSlot: 1 } });

describe('SequelizeEmailConfirmationTokenRepository — real MySQL replacement', () => {
  const repository = new SequelizeEmailConfirmationTokenRepository();
  let userId: number;

  beforeAll(async () => {
    await bootstrapTestDatabase();
    userId = await seedTestUser();
  });

  afterAll(async () => {
    await deleteTestUser(userId);
    await closeTestDatabase();
  });

  it('locks the user and atomically invalidates the current token before inserting its replacement', async () => {
    const oldHash = `old-${crypto.randomUUID()}`;
    const newHash = `new-${crypto.randomUUID()}`;
    const now = new Date('2026-10-01T12:00:00.000Z');
    await db.EmailConfirmationToken.create({
      idUser: userId,
      tokenHash: oldHash,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 86400000),
      activeSlot: 1,
    });

    await db.sequelize.transaction((transaction: Transaction) =>
      repository.replaceForUnverifiedUser({
        userId,
        tokenHash: newHash,
        now,
        tx: asTx(transaction),
      }),
    );

    const old = await db.EmailConfirmationToken.findOne({ where: { tokenHash: oldHash } });
    const current = await db.EmailConfirmationToken.findOne({ where: { tokenHash: newHash } });
    expect(old?.activeSlot).toBeNull();
    expect(old?.invalidatedAt).not.toBeNull();
    expect(current).toEqual(
      expect.objectContaining({ idUser: userId, activeSlot: 1, tokenHash: newHash }),
    );
  });

  it('rolls back replacement and lets one user-locked race winner supersede the other', async () => {
    const before = await activeRows(userId);
    const rollbackHash = `rollback-${crypto.randomUUID()}`;
    await expect(
      db.sequelize.transaction(async (transaction: Transaction) => {
        await repository.replaceForUnverifiedUser({
          userId,
          tokenHash: rollbackHash,
          now: new Date(),
          tx: asTx(transaction),
        });
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');
    expect(await db.EmailConfirmationToken.count({ where: { tokenHash: rollbackHash } })).toBe(0);
    expect(await activeRows(userId)).toHaveLength(before.length);

    const raceHashes = ['a', 'b'].map((suffix) => `race-${suffix}-${crypto.randomUUID()}`);
    await Promise.all(
      raceHashes.map((tokenHash) =>
        db.sequelize.transaction((transaction: Transaction) =>
          repository.replaceForUnverifiedUser({
            userId,
            tokenHash,
            now: new Date(),
            tx: asTx(transaction),
          }),
        ),
      ),
    );
    const replacements = await db.EmailConfirmationToken.findAll({
      where: { tokenHash: raceHashes },
    });
    expect(await activeRows(userId)).toHaveLength(1);
    expect(replacements).toHaveLength(2);
    expect(
      replacements.filter((row: { activeSlot: number | null }) => row.activeSlot === 1),
    ).toHaveLength(1);
    expect(
      replacements.filter(
        (row: { activeSlot: number | null; invalidatedAt: Date | null }) =>
          row.activeSlot === null && row.invalidatedAt !== null,
      ),
    ).toHaveLength(1);
  });

  it('uses MySQL active-slot uniqueness as a concurrent direct-insert backstop', async () => {
    await db.EmailConfirmationToken.update(
      { activeSlot: null, invalidatedAt: new Date() },
      { where: { idUser: userId, activeSlot: 1 } },
    );
    const attempts = await Promise.allSettled(
      ['a', 'b'].map((suffix) =>
        db.EmailConfirmationToken.create({
          idUser: userId,
          tokenHash: `unique-backstop-${suffix}-${crypto.randomUUID()}`,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          activeSlot: 1,
        }),
      ),
    );

    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await activeRows(userId)).toHaveLength(1);
  });
});
