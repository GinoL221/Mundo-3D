import type { Sequelize, Transaction } from 'sequelize';
import {
  SequelizeSandboxReleaseControl,
  SequelizeSandboxReleaseFence,
} from '../SequelizeSandboxReleasePorts';
import type { SandboxReleaseIdentity } from '../../../domain/ports/AuthoritativeReleaseStateReaderPort';
import { withScopedTransaction } from '../scopedTransactionContext';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
const identity: SandboxReleaseIdentity = {
  releaseId: '33333333-3333-3333-3333-333333333333',
  slotId: 'slot-a',
  leaseId: '22222222-2222-2222-2222-222222222222',
  generation: 3,
  attemptId: '11111111-1111-1111-1111-111111111111',
  seedVersion: 'v1',
};

type QueryLog = Array<{ sql: string; options?: unknown }>;

interface Harness {
  connection: Sequelize;
  log: QueryLog;
  run: <T>(work: (context: TransactionContext) => Promise<T>) => Promise<T>;
}

function connectionWith(handlers: Array<(sql: string) => unknown>): Harness {
  const log: QueryLog = [];
  const queue = [...handlers];
  const connection = {
    query: async (sql: string, options?: unknown) => {
      log.push({ sql, options });
      const next = queue.shift();
      if (!next) throw new Error(`unexpected query: ${sql}`);
      return next(sql);
    },
  } as unknown as Sequelize;
  const transaction = { sequelize: connection } as unknown as Transaction;
  return {
    connection,
    log,
    run: (work) => withScopedTransaction(connection, transaction, work),
  };
}

const controlRow = {
  slot_id: 'slot-a',
  status: 'resetting',
  generation: 3,
  lease_id: identity.leaseId,
  reset_attempt_id: identity.attemptId,
};

const fencedRow = {
  slot_id: 'slot-a',
  state: 'fenced',
  generation: 3,
  reset_attempt_id: identity.attemptId,
};

describe('SequelizeSandboxReleaseControl', () => {
  function control(handlers: Array<(sql: string) => unknown>) {
    const harness = connectionWith(handlers);
    return {
      port: new SequelizeSandboxReleaseControl(harness.connection, identity.slotId, 'control', 'slot'),
      log: harness.log,
      run: harness.run,
    };
  }

  it('locks the control row first and accepts an exact resetting match', async () => {
    const { port, log, run } = control([() => [[controlRow], []]]);
    await run(async (tx) => expect(port.lockAndCheck(identity, tx)).resolves.toBe(true));
    expect(log[0].sql).toContain('`control`.`DemoSandboxSlot`');
    expect(log[0].sql).toContain('FOR UPDATE');
    expect(log[0].options).toMatchObject({ replacements: [identity.slotId] });
    expect((log[0].options as { transaction?: unknown }).transaction).toBeDefined();
  });

  it.each([
    ['an available phase', { ...controlRow, status: 'available' }],
    ['another generation', { ...controlRow, generation: 4 }],
    ['another lease', { ...controlRow, lease_id: 'other' }],
    ['another attempt', { ...controlRow, reset_attempt_id: 'other' }],
    ['no row', null],
  ])('rejects %s', async (_label, row) => {
    const { port, run } = control([() => [[row === null ? [] : [row]], []]]);
    await run(async (tx) => expect(port.lockAndCheck(identity, tx)).resolves.toBe(false));
  });

  it('rejects a foreign slot before any query', async () => {
    const { port, log, run } = control([]);
    await run(async (tx) =>
      expect(port.lockAndCheck({ ...identity, slotId: 'slot-b' }, tx)).resolves.toBe(false),
    );
    expect(log).toHaveLength(0);
  });

  it('releases control and fence together with a compare-and-swap predicate', async () => {
    const { port, log, run } = control([
      () => [{ affectedRows: 1 }, []],
      () => [{ affectedRows: 1 }, []],
    ]);
    await run(async (tx) => expect(port.release(identity, tx)).resolves.toBe(true));
    const [controlUpdate, fenceUpdate] = log;
    expect(controlUpdate.sql).toContain('UPDATE `control`.`DemoSandboxSlot`');
    expect(controlUpdate.sql).toContain('generation = generation + 1');
    expect(controlUpdate.sql).toContain("status = 'available'");
    expect(controlUpdate.sql).toContain('lease_id = NULL');
    expect(controlUpdate.sql).toContain('reset_attempt_id = NULL');
    expect(fenceUpdate.sql).toContain('UPDATE `slot`.`DemoSandboxFence`');
    expect(fenceUpdate.sql).toContain("state = 'open'");
    expect(fenceUpdate.sql).toContain('generation = generation + 1');
  });

  it('reports a failed release when storage did not advance the control row', async () => {
    const { port, run } = control([
      () => [{ affectedRows: 0 }, []],
      () => [{ affectedRows: 1 }, []],
    ]);
    await run(async (tx) => expect(port.release(identity, tx)).resolves.toBe(false));
  });
});

describe('SequelizeSandboxReleaseFence', () => {
  function fence(handlers: Array<(sql: string) => unknown>) {
    const harness = connectionWith(handlers);
    return {
      port: new SequelizeSandboxReleaseFence(harness.connection, identity.slotId, 'slot'),
      log: harness.log,
      run: harness.run,
    };
  }

  it('locks the fence row and accepts an exact fenced match', async () => {
    const { port, log, run } = fence([() => [[fencedRow], []]]);
    await run(async (tx) => expect(port.lockAndCheck(identity, tx)).resolves.toBe(true));
    expect(log[0].sql).toContain('`slot`.`DemoSandboxFence`');
    expect(log[0].sql).toContain('FOR UPDATE');
  });

  it.each([
    ['an open barrier', { ...fencedRow, state: 'open' }],
    ['another generation', { ...fencedRow, generation: 4 }],
    ['another attempt', { ...fencedRow, reset_attempt_id: 'other' }],
    ['no row', null],
  ])('rejects %s', async (_label, row) => {
    const { port, run } = fence([() => [[row === null ? [] : [row]], []]]);
    await run(async (tx) => expect(port.lockAndCheck(identity, tx)).resolves.toBe(false));
  });
});
