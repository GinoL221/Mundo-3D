import type { TransactionContext, UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';
import { RunFencedSandboxReset } from '../use-cases/RunFencedSandboxReset';

const identity = { slotId: 'slot-a', generation: 1, attemptId: 'attempt-a', seedVersion: 'v1' };
const tx = {} as TransactionContext;

function setup() {
  const order: string[] = [];
  const uow: UnitOfWorkPort = { runInTransaction: async (work) => work(tx) };
  const fence = {
    lockAndCheck: jest.fn(async () => {
      order.push('fence');
      return true;
    }),
  };
  const receipts = {
    exists: jest.fn(async () => {
      order.push('exists');
      return false;
    }),
    insert: jest.fn(async () => {
      order.push('receipt');
    }),
  };
  const reset = {
    run: jest.fn(async () => {
      order.push('reset');
    }),
    verify: jest.fn(async () => {
      order.push('verify');
      return true;
    }),
  };
  return {
    order,
    fence,
    receipts,
    reset,
    runner: new RunFencedSandboxReset(uow, fence, receipts, reset),
  };
}

describe('RunFencedSandboxReset', () => {
  it('forwards one context across fence, replay check, reset, verification and receipt', async () => {
    const { runner, order, fence, receipts, reset } = setup();
    await expect(runner.execute(identity)).resolves.toBeUndefined();
    expect(order).toEqual(['fence', 'exists', 'reset', 'verify', 'receipt']);
    for (const mock of [
      fence.lockAndCheck,
      receipts.exists,
      reset.run,
      reset.verify,
      receipts.insert,
    ]) {
      expect(mock).toHaveBeenCalledWith(identity, tx);
    }
  });

  it('rejects a failed fence before reading receipts or resetting', async () => {
    const { runner, fence, receipts, reset } = setup();
    fence.lockAndCheck.mockResolvedValue(false);
    await expect(runner.execute(identity)).rejects.toThrow('Sandbox reset fence rejected');
    expect(receipts.exists).not.toHaveBeenCalled();
    expect(reset.run).not.toHaveBeenCalled();
    expect(receipts.insert).not.toHaveBeenCalled();
  });

  it('rejects a duplicate receipt before reset effects', async () => {
    const { runner, receipts, reset } = setup();
    receipts.exists.mockResolvedValue(true);
    await expect(runner.execute(identity)).rejects.toThrow('Sandbox reset receipt already exists');
    expect(reset.run).not.toHaveBeenCalled();
    expect(receipts.insert).not.toHaveBeenCalled();
  });

  it('rejects failed verification without issuing a receipt', async () => {
    const { runner, receipts, reset } = setup();
    reset.verify.mockResolvedValue(false);
    await expect(runner.execute(identity)).rejects.toThrow('Sandbox reset verification failed');
    expect(receipts.insert).not.toHaveBeenCalled();
  });

  it('propagates fence lock/check errors and aborts execution', async () => {
    const { runner, receipts, reset, fence } = setup();
    const err = new Error('lock timeout');
    fence.lockAndCheck.mockRejectedValue(err);
    await expect(runner.execute(identity)).rejects.toThrow(err);
    expect(receipts.exists).not.toHaveBeenCalled();
    expect(reset.run).not.toHaveBeenCalled();
    expect(reset.verify).not.toHaveBeenCalled();
    expect(receipts.insert).not.toHaveBeenCalled();
  });

  it('propagates reset execution errors and aborts before verification or receipt', async () => {
    const { runner, receipts, reset } = setup();
    const err = new Error('DML failure during reset');
    reset.run.mockRejectedValue(err);
    await expect(runner.execute(identity)).rejects.toThrow(err);
    expect(reset.verify).not.toHaveBeenCalled();
    expect(receipts.insert).not.toHaveBeenCalled();
  });

  it('propagates receipt insertion errors', async () => {
    const { runner, receipts } = setup();
    const err = new Error('receipt write failed');
    receipts.insert.mockRejectedValue(err);
    await expect(runner.execute(identity)).rejects.toThrow(err);
  });

  it('propagates receipt existence check errors and aborts', async () => {
    const { runner, receipts, reset } = setup();
    const err = new Error('receipt read failed');
    receipts.exists.mockRejectedValue(err);
    await expect(runner.execute(identity)).rejects.toThrow(err);
    expect(reset.run).not.toHaveBeenCalled();
    expect(reset.verify).not.toHaveBeenCalled();
    expect(receipts.insert).not.toHaveBeenCalled();
  });

  it('propagates verification execution errors and aborts before receipt', async () => {
    const { runner, reset, receipts } = setup();
    const err = new Error('verification probe failed');
    reset.verify.mockRejectedValue(err);
    await expect(runner.execute(identity)).rejects.toThrow(err);
    expect(receipts.insert).not.toHaveBeenCalled();
  });

  it('propagates unit of work transaction initialization errors', async () => {
    const err = new Error('UoW connection pool exhausted');
    const failingUow: UnitOfWorkPort = { runInTransaction: jest.fn().mockRejectedValue(err) };
    const fence = { lockAndCheck: jest.fn() };
    const receipts = { exists: jest.fn(), insert: jest.fn() };
    const reset = { run: jest.fn(), verify: jest.fn() };
    const runner = new RunFencedSandboxReset(failingUow, fence, receipts, reset);

    await expect(runner.execute(identity)).rejects.toThrow(err);
    expect(fence.lockAndCheck).not.toHaveBeenCalled();
  });
});
