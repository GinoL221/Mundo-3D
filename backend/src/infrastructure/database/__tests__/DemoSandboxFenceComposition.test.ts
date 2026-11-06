import type { Sequelize, Transaction } from 'sequelize';
import { createDemoSandboxFenceTransaction } from '../DemoSandboxFenceComposition';

describe('createDemoSandboxFenceTransaction', () => {
  it('composes the model, lock and unit of work on the supplied connection', async () => {
    const transaction = { LOCK: { SHARE: 'SHARE' } } as unknown as Transaction;
    const findOne = jest
      .fn()
      .mockResolvedValue({ slotId: 'slot-1', leaseId: 'lease-1', generation: 1, state: 'open' });
    const define = jest.fn().mockReturnValue({ findOne });
    const runTransaction = jest.fn(async (work: (tx: Transaction) => Promise<unknown>) =>
      work(transaction),
    );
    const connection = { define, transaction: runTransaction } as unknown as Sequelize;
    Object.assign(transaction, { sequelize: connection });
    const work = jest.fn(async () => 'done');
    const execute = createDemoSandboxFenceTransaction(connection, 'slot-1');
    await expect(
      execute.execute({ slotId: 'slot-1', leaseId: 'lease-1', generation: 1 }, work),
    ).resolves.toBe('done');
    expect(define).toHaveBeenCalledTimes(1);
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({
      where: { slotId: 'slot-1' },
      transaction,
      lock: 'SHARE',
    });
    expect(work).toHaveBeenCalledTimes(1);

    // Repeated call should reuse the cached model on the same connection
    createDemoSandboxFenceTransaction(connection, 'slot-1');
    expect(define).toHaveBeenCalledTimes(1);
  });

  it('does not run business work for a different slot', async () => {
    const transaction = { LOCK: { SHARE: 'SHARE' } } as unknown as Transaction;
    const findOne = jest.fn();
    const connection = {
      define: jest.fn().mockReturnValue({ findOne }),
      transaction: async (work: (tx: Transaction) => Promise<unknown>) => work(transaction),
    } as unknown as Sequelize;
    Object.assign(transaction, { sequelize: connection });
    const work = jest.fn(async () => 'done');
    await expect(
      createDemoSandboxFenceTransaction(connection, 'slot-1').execute(
        { slotId: 'slot-2', leaseId: 'lease-1', generation: 1 },
        work,
      ),
    ).rejects.toThrow('Sandbox fence rejected');
    expect(findOne).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
  });
});
