import type { TransactionContext, UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';
import { ReleaseSandboxInTransaction } from '../use-cases/ReleaseSandboxInTransaction';

const tx = {} as TransactionContext;
const identity = {
  slotId: 'slot-a',
  generation: 3,
  attemptId: 'attempt-a',
  seedVersion: 'v1',
  leaseId: 'lease-a',
  releaseId: 'release-a',
};

function setup() {
  const order: string[] = [];
  const uow: UnitOfWorkPort = { runInTransaction: async (work) => work(tx) };
  const control = {
    lockAndCheck: jest.fn(async () => {
      order.push('control');
      return true;
    }),
    release: jest.fn(async () => {
      order.push('release');
      return true;
    }),
  };
  const fence = {
    lockAndCheck: jest.fn(async () => {
      order.push('fence');
      return true;
    }),
  };
  const receipts = {
    consume: jest.fn(async () => {
      order.push('receipt');
      return true;
    }),
  };
  const recorder = {
    record: jest.fn(async () => {
      order.push('record');
    }),
    exists: jest.fn(async () => false),
  };
  return {
    order,
    uow,
    control,
    fence,
    receipts,
    recorder,
    runner: new ReleaseSandboxInTransaction(uow, control, fence, receipts, recorder),
  };
}

describe('ReleaseSandboxInTransaction', () => {
  it('uses one context in control-fence-receipt-release-record order', async () => {
    const { runner, order, control, fence, receipts, recorder } = setup();
    await expect(runner.execute(identity)).resolves.toBe('released');
    expect(order).toEqual(['control', 'fence', 'receipt', 'release', 'record']);
    for (const mock of [
      control.lockAndCheck,
      fence.lockAndCheck,
      receipts.consume,
      control.release,
      recorder.record,
    ]) {
      expect(mock).toHaveBeenCalledWith(identity, tx);
      const calls = mock.mock.calls as unknown as Array<[unknown, TransactionContext]>;
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toBe(tx);
    }
  });

  it.each(['control', 'fence', 'receipt'] as const)(
    'rejects %s mismatch before release',
    async (step) => {
      const { runner, control, fence, receipts } = setup();
      if (step === 'control') control.lockAndCheck.mockResolvedValue(false);
      if (step === 'fence') fence.lockAndCheck.mockResolvedValue(false);
      if (step === 'receipt') receipts.consume.mockResolvedValue(false);
      await expect(runner.execute(identity)).resolves.toBe('rejected');
      expect(control.release).not.toHaveBeenCalled();
      if (step === 'control') expect(fence.lockAndCheck).not.toHaveBeenCalled();
      if (step !== 'receipt') expect(receipts.consume).not.toHaveBeenCalled();
    },
  );

  it('throws inside the transaction if release fails after receipt consumption', async () => {
    const { runner, control, uow, fence, receipts } = setup();
    control.release.mockResolvedValue(false);
    const rollbackObserver = jest.fn();
    const observingUow: UnitOfWorkPort = {
      runInTransaction: async (work) => {
        try {
          return await uow.runInTransaction(work);
        } catch (error) {
          rollbackObserver(error);
          throw error;
        }
      },
    };
    const observed = new ReleaseSandboxInTransaction(observingUow, control, fence, receipts, { record: async () => {}, exists: async () => false });
    await expect(observed.execute(identity)).resolves.toBe('uncertain');
    expect(rollbackObserver).toHaveBeenCalledTimes(1);
  });

  it('reports uncertainty when commit acknowledgement is lost after the callback', async () => {
    const { control, fence, receipts } = setup();
    let callbackResult: unknown;
    const uow: UnitOfWorkPort = {
      runInTransaction: jest.fn(async (work) => {
        callbackResult = await work(tx);
        throw new Error('commit acknowledgement lost');
      }),
    };
    const runner = new ReleaseSandboxInTransaction(uow, control, fence, receipts, { record: async () => {}, exists: async () => false });
    await expect(runner.execute(identity)).resolves.toBe('uncertain');
    expect(callbackResult).toBe('released');
    expect(uow.runInTransaction).toHaveBeenCalledTimes(1);
    expect(control.lockAndCheck).toHaveBeenCalledTimes(1);
    expect(fence.lockAndCheck).toHaveBeenCalledTimes(1);
    expect(receipts.consume).toHaveBeenCalledTimes(1);
    expect(control.release).toHaveBeenCalledTimes(1);
  });

  it('reports uncertainty when the unit of work rejects before the callback', async () => {
    const { control, fence, receipts } = setup();
    const uow: UnitOfWorkPort = {
      runInTransaction: jest.fn().mockRejectedValue(new Error('commit acknowledgement lost')),
    };
    const runner = new ReleaseSandboxInTransaction(uow, control, fence, receipts, { record: async () => {}, exists: async () => false });
    await expect(runner.execute(identity)).resolves.toBe('uncertain');
    expect(uow.runInTransaction).toHaveBeenCalledTimes(1);
    expect(control.release).not.toHaveBeenCalled();
  });
});
