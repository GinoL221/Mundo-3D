import type { TransactionContext, UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';
import { RunFencedSandboxTransaction } from '../use-cases/RunFencedSandboxTransaction';

describe('RunFencedSandboxTransaction', () => {
  const tx = {} as TransactionContext;
  const lease = { slotId: 'slot-1', leaseId: 'lease-1', generation: 1 };

  it('checks the fence in the transaction before business work', async () => {
    const order: string[] = [];
    const uow: UnitOfWorkPort = { runInTransaction: async (work) => work(tx) };
    const check = jest.fn(async () => { order.push('fence'); return true; });
    const work = jest.fn(async (context: TransactionContext) => {
      expect(context).toBe(tx);
      order.push('work');
      return 'result';
    });
    await expect(new RunFencedSandboxTransaction(uow, { check }).execute(lease, work)).resolves.toBe('result');
    expect(check).toHaveBeenCalledWith(lease, tx);
    expect(order).toEqual(['fence', 'work']);
  });

  it('rejects a failed fence without running business work', async () => {
    const uow: UnitOfWorkPort = { runInTransaction: async (work) => work(tx) };
    const work = jest.fn(async () => 'result');
    await expect(new RunFencedSandboxTransaction(uow, { check: async () => false }).execute(lease, work)).rejects.toThrow('Sandbox fence rejected');
    expect(work).not.toHaveBeenCalled();
  });

  it('propagates fence errors without running business work', async () => {
    const failure = new Error('fence unavailable');
    const uow: UnitOfWorkPort = { runInTransaction: async (work) => work(tx) };
    const work = jest.fn(async () => 'result');
    await expect(new RunFencedSandboxTransaction(uow, { check: async () => { throw failure; } }).execute(lease, work)).rejects.toBe(failure);
    expect(work).not.toHaveBeenCalled();
  });
});
