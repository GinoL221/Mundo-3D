import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import db from '../../../database/models/db';
import { SequelizeEmailConfirmationTokenRepository } from '../SequelizeEmailConfirmationTokenRepository';

jest.mock('dotenv', () => {
  throw new Error('dotenv forbidden');
});
jest.mock('../../../database/models/db', () => ({
  __esModule: true,
  default: {
    User: { findByPk: jest.fn() },
    EmailConfirmationToken: { findOne: jest.fn(), update: jest.fn(), create: jest.fn() },
  },
}));

test('legacy wrapper accepts direct raw transaction context', async () => {
  jest.mocked(db.User.findByPk).mockResolvedValueOnce(null);
  const tx = {} as TransactionContext;
  await expect(
    new SequelizeEmailConfirmationTokenRepository().verifyAndConsume({
      userId: 1,
      tokenHash: 'hash',
      now: new Date(),
      tx,
    }),
  ).resolves.toEqual({ outcome: 'invalid' });
  expect(db.User.findByPk).toHaveBeenCalledWith(1, expect.objectContaining({ transaction: tx }));
});
