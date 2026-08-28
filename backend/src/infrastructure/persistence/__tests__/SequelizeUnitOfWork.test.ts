import { SequelizeUnitOfWork } from '../SequelizeUnitOfWork';
import db from '../../../database/models/db';

jest.mock('../../../database/models/db', () => ({
  sequelize: {
    transaction: jest.fn(),
  },
}));

describe('SequelizeUnitOfWork', () => {
  let uow: SequelizeUnitOfWork;

  beforeEach(() => {
    uow = new SequelizeUnitOfWork();
    jest.clearAllMocks();
  });

  it('delegates to db.sequelize.transaction, passing the Sequelize transaction through as the opaque TransactionContext', async () => {
    const fakeTx = { id: 'fake-tx' };
    (db.sequelize.transaction as jest.Mock).mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work(fakeTx));

    const result = await uow.runInTransaction(async (tx) => {
      expect(tx).toBe(fakeTx);
      return 'committed-value';
    });

    expect(result).toBe('committed-value');
    expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
  });

  it('propagates a thrown error from the work callback so Sequelize rolls back the managed transaction', async () => {
    const fakeTx = { id: 'fake-tx' };
    const boom = new Error('checkout failed');
    (db.sequelize.transaction as jest.Mock).mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work(fakeTx));

    await expect(
      uow.runInTransaction(async () => {
        throw boom;
      })
    ).rejects.toThrow(boom);
  });
});
