import { CoordinateSandboxRelease } from '../CoordinateSandboxRelease';
import type { UnitOfWorkPort, TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import type { SandboxReleaseIdentity } from '../../../domain/ports/AuthoritativeReleaseStateReaderPort';
import type { RecordedReleaseSession } from '../../../domain/ports/SandboxReleaseSessionRecorderPort';
import { ReleaseSandboxInTransaction } from '../../../application/use-cases/ReleaseSandboxInTransaction';

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
  connectionId: { current: jest.Mock };
  control: { lockAndCheck: jest.Mock; release: jest.Mock };
  fence: { lockAndCheck: jest.Mock };
  receipts: { consume: jest.Mock };
  releaseRecorder: { record: jest.Mock };
  reader: { readState: jest.Mock };
  runCoordinator: () => ReturnType<CoordinateSandboxRelease['execute']>;
}

function setup(options?: {
  connectionIdInTransaction?: string;
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
    current: jest.fn(async () => options?.connectionIdInTransaction ?? recorded.connectionId),
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
    expect(connectionId.current).toHaveBeenCalledWith(tx);
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
      connectionId: { current: async () => '99' },
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
        connectionId: { current: jest.fn() },
        control: { lockAndCheck: jest.fn(), release: jest.fn() },
        fence: { lockAndCheck: jest.fn() },
        receipts: { consume: jest.fn() },
        releaseRecorder: { record: jest.fn(), exists: jest.fn(async () => false) },
        reader,
      }).reconcile(identity, recorded),
    ).resolves.toBeNull();
    expect(reader.readState).toHaveBeenCalledWith(identity, recorded);
  });

  it('composes with the real seam type', () => {
    const seam = new ReleaseSandboxInTransaction(
      passThroughUow,
      { lockAndCheck: jest.fn(), release: jest.fn() },
      { lockAndCheck: jest.fn() },
      { consume: jest.fn() },
      { record: jest.fn(), exists: jest.fn(async () => false) },
    );
    expect(seam).toBeInstanceOf(ReleaseSandboxInTransaction);
  });
});
