import { CoordinateSandboxRelease } from '../CoordinateSandboxRelease';
import type { UnitOfWorkPort, TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import type { SandboxReleaseIdentity } from '../../../domain/ports/AuthoritativeReleaseStateReaderPort';
import type { RecordedReleaseSession } from '../../../domain/ports/SandboxReleaseSessionRecorderPort';

const identity: SandboxReleaseIdentity = {
  releaseId: '33333333-3333-3333-3333-333333333333',
  slotId: 'slot-a',
  leaseId: '22222222-2222-2222-2222-222222222222',
  generation: 3,
  attemptId: '11111111-1111-1111-1111-111111111111',
  seedVersion: 'v1',
};

const recorded: RecordedReleaseSession = {
  attemptId: identity.attemptId,
  slotId: identity.slotId,
  generation: identity.generation,
  serverUuid: 'uuid-1',
  connectionId: '12',
};

const tx = {} as TransactionContext;
const passThroughUow: UnitOfWorkPort = { runInTransaction: async (work) => work(tx) };

interface Harness {
  order: string[];
  sessions: { recordSession: jest.Mock };
  connectionId: { snapshot: jest.Mock };
  control: { lockAndCheck: jest.Mock; release: jest.Mock };
  fence: { lockAndCheck: jest.Mock };
  receipts: { consume: jest.Mock };
  releaseRecorder: { record: jest.Mock };
  reader: { readState: jest.Mock };
  runCoordinator: () => ReturnType<CoordinateSandboxRelease['execute']>;
}

function setup(options?: {
  connectionIdInTransaction?: string;
  serverUuidInTransaction?: string;
  recordSession?: () => Promise<RecordedReleaseSession>;
}): Harness {
  const order: string[] = [];
  const sessions = {
    recordSession: jest.fn(options?.recordSession ?? (async () => {
      order.push('record');
      return recorded;
    })),
  };
  const connectionId = {
    snapshot: jest.fn(async () => ({
      connectionId: options?.connectionIdInTransaction ?? recorded.connectionId,
      serverUuid: options?.serverUuidInTransaction ?? recorded.serverUuid,
    })),
  };
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
  const releaseRecorder = {
    record: jest.fn(async () => {
      order.push('record-release');
    }),
    exists: jest.fn(async () => false),
  };
  const reader = { readState: jest.fn(async () => null) };
  const coordinator = new CoordinateSandboxRelease({
    uow: passThroughUow,
    sessions,
    connectionId,
    control,
    fence,
    receipts,
    releaseRecorder,
    reader,
  });
  return {
    order,
    sessions,
    connectionId,
    control,
    fence,
    receipts,
    releaseRecorder,
    reader,
    runCoordinator: () => coordinator.execute(identity),
  };
}

describe('CoordinateSandboxRelease', () => {
  it('records the session first, verifies continuity, then runs the release sequence', async () => {
    const { runCoordinator, order, sessions, connectionId } = setup();
    const result = await runCoordinator();
    expect(result).toMatchObject({ outcome: 'released', recorded });
    expect(order).toEqual(['record', 'control', 'fence', 'receipt', 'release', 'record-release']);
    expect(sessions.recordSession).toHaveBeenCalledWith(identity);
    expect(connectionId.snapshot).toHaveBeenCalledWith(tx);
  });

  it('reports uncertain and rolls back when the held connection identity drifted', async () => {
    const rollback = jest.fn();
    const observing: UnitOfWorkPort = {
      runInTransaction: async (work) => {
        try {
          return await passThroughUow.runInTransaction(work);
        } catch (error) {
          rollback(error);
          throw error;
        }
      },
    };
    const coordinator = new CoordinateSandboxRelease({
      uow: observing,
      sessions: { recordSession: async () => recorded },
      connectionId: { snapshot: async () => ({ connectionId: '99', serverUuid: recorded.serverUuid }) },
      control: { lockAndCheck: jest.fn(), release: jest.fn() },
      fence: { lockAndCheck: jest.fn() },
      receipts: { consume: jest.fn() },
      releaseRecorder: { record: jest.fn(), exists: jest.fn(async () => false) },
      reader: { readState: jest.fn() },
    });
    await expect(coordinator.execute(identity)).resolves.toMatchObject({ outcome: 'uncertain' });
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(rollback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(String(rollback.mock.calls[0][0].message)).toMatch(/continuity/i);
    expect(coordinator['control'].lockAndCheck).not.toHaveBeenCalled();
  });

  it('reports uncertain when the server identity drifts even with the same connection id', async () => {
    const rollback = jest.fn();
    const observing: UnitOfWorkPort = {
      runInTransaction: async (work) => {
        try {
          return await passThroughUow.runInTransaction(work);
        } catch (error) {
          rollback(error);
          throw error;
        }
      },
    };
    const coordinator = new CoordinateSandboxRelease({
      uow: observing,
      sessions: { recordSession: async () => recorded },
      connectionId: {
        snapshot: async () => ({ connectionId: recorded.connectionId, serverUuid: 'uuid-after-restart' }),
      },
      control: { lockAndCheck: jest.fn(), release: jest.fn() },
      fence: { lockAndCheck: jest.fn() },
      receipts: { consume: jest.fn() },
      releaseRecorder: { record: jest.fn(), exists: jest.fn(async () => false) },
      reader: { readState: jest.fn() },
    });
    await expect(coordinator.execute(identity)).resolves.toMatchObject({ outcome: 'uncertain' });
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(coordinator['control'].lockAndCheck).not.toHaveBeenCalled();
  });

  it('accepts a numeric connection id equal to the recorded one', async () => {
    const { runCoordinator } = setup({ connectionIdInTransaction: ' 12 ' });
    await expect(runCoordinator()).resolves.toMatchObject({ outcome: 'released' });
  });

  it.each([
    ['a non-numeric recorded id', { connectionId: 'thread-12' }],
    ['a zero recorded id', { connectionId: '0' }],
    ['an unsafe recorded id', { connectionId: '99999999999999999999' }],
  ])('refuses %s inside the transaction', async (_label, patch) => {
    const rollback = jest.fn();
    const observing: UnitOfWorkPort = {
      runInTransaction: async (work) => {
        try {
          return await passThroughUow.runInTransaction(work);
        } catch (error) {
          rollback(error);
          throw error;
        }
      },
    };
    const control = { lockAndCheck: jest.fn(), release: jest.fn() };
    const coordinator = new CoordinateSandboxRelease({
      uow: observing,
      sessions: { recordSession: async () => ({ ...recorded, ...patch }) },
      connectionId: {
        snapshot: async () => ({ connectionId: recorded.connectionId, serverUuid: recorded.serverUuid }),
      },
      control,
      fence: { lockAndCheck: jest.fn() },
      receipts: { consume: jest.fn() },
      releaseRecorder: { record: jest.fn(), exists: jest.fn(async () => false) },
      reader: { readState: jest.fn() },
    });
    await expect(coordinator.execute(identity)).resolves.toMatchObject({ outcome: 'uncertain' });
    expect(String(rollback.mock.calls[0][0]?.message)).toMatch(/continuity/i);
    expect(control.lockAndCheck).not.toHaveBeenCalled();
  });

  it('records the guard error when the live id is unusable', async () => {
    const rollback = jest.fn();
    const observing: UnitOfWorkPort = {
      runInTransaction: async (work) => {
        try {
          return await passThroughUow.runInTransaction(work);
        } catch (error) {
          rollback(error);
          throw error;
        }
      },
    };
    const coordinator = new CoordinateSandboxRelease({
      uow: observing,
      sessions: { recordSession: async () => recorded },
      connectionId: {
        snapshot: async () => ({ connectionId: 'not-a-thread-id', serverUuid: recorded.serverUuid }),
      },
      control: { lockAndCheck: jest.fn(), release: jest.fn() },
      fence: { lockAndCheck: jest.fn() },
      receipts: { consume: jest.fn() },
      releaseRecorder: { record: jest.fn(), exists: jest.fn(async () => false) },
      reader: { readState: jest.fn() },
    });
    await expect(coordinator.execute(identity)).resolves.toMatchObject({ outcome: 'uncertain' });
    expect(String(rollback.mock.calls[0][0]?.message)).toMatch(/continuity/i);
  });

  it('propagates a session-recording failure without starting the transaction', async () => {
    const failure = new Error('recording refused');
    const { runCoordinator, control } = setup({
      recordSession: async () => {
        throw failure;
      },
    });
    await expect(runCoordinator()).rejects.toBe(failure);
    expect(control.lockAndCheck).not.toHaveBeenCalled();
  });

  it('delegates reconciliation to the reader with the recorded session', async () => {
    const { runCoordinator, reader } = setup();
    await runCoordinator();
    await expect(
      new CoordinateSandboxRelease({
        uow: passThroughUow,
        sessions: { recordSession: jest.fn() },
        connectionId: { snapshot: jest.fn(async () => ({ connectionId: recorded.connectionId, serverUuid: recorded.serverUuid })) },
        control: { lockAndCheck: jest.fn(), release: jest.fn() },
        fence: { lockAndCheck: jest.fn() },
        receipts: { consume: jest.fn() },
        releaseRecorder: { record: jest.fn(), exists: jest.fn(async () => false) },
        reader,
      }).reconcile(identity, recorded),
    ).resolves.toBeNull();
    expect(reader.readState).toHaveBeenCalledWith(identity, recorded);
  });
});
