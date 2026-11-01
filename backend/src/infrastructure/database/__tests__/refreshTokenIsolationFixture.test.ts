import { createScopedRefreshTokenAdapters, probeConcurrentScopedTransactions } from './refreshTokenIsolationFixture';
import type { RememberTokenPersistence } from '../../repositories/ScopedSequelizeRememberTokenRepository';
import type { Sequelize } from 'sequelize';
import type { UnitOfWorkPort } from '../../../domain/ports/UnitOfWorkPort';

test('adapter construction is inert and binds repository transactions to the supplied connection', async () => {
  const tx = {};
  const query = jest.fn(async () => [undefined, 1]);
  const transaction = jest.fn(async (work: (handle: object) => Promise<unknown>) => work(tx));
  const connection = { query, transaction };
  const model = { sequelize: connection, findOne: jest.fn() };
  const db = { sequelize: connection, RememberToken: model } as unknown as RememberTokenPersistence;
  const adapters = createScopedRefreshTokenAdapters(db);
  expect(transaction).not.toHaveBeenCalled();
  expect(query).not.toHaveBeenCalled();
  expect(model.findOne).not.toHaveBeenCalled();
  await adapters.uow.runInTransaction(async (context) => {
    await expect(adapters.repository.claimRotation({ presentedHash: 'a', successorHash: 'b', tx: context })).resolves.toBe(true);
  });
  expect(query).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ transaction: tx }));
  const foreignConnection = { transaction };
  const foreign = createScopedRefreshTokenAdapters({
    sequelize: foreignConnection,
    RememberToken: { sequelize: foreignConnection },
  } as unknown as RememberTokenPersistence);
  await foreign.uow.runInTransaction(async (context) => {
    await expect(adapters.repository.claimRotation({ presentedHash: 'a', successorHash: 'b', tx: context })).rejects.toThrow('Transaction context is not active for this connection');
  });
  expect(query).toHaveBeenCalledTimes(1);
});

test.each(['missing', 'mismatch'] as const)('rejects %s model connection without queries or transactions', (binding) => {
  const query = jest.fn();
  const transaction = jest.fn();
  const foreignQuery = jest.fn();
  const foreignTransaction = jest.fn();
  const connection = { query, transaction };
  const foreignConnection = { query: foreignQuery, transaction: foreignTransaction };
  const model = { sequelize: binding === 'missing' ? undefined : foreignConnection };
  const db = { sequelize: connection, RememberToken: model } as unknown as RememberTokenPersistence;
  expect(() => createScopedRefreshTokenAdapters(db)).toThrow('RememberToken model must be bound to the supplied connection');
  expect(query).not.toHaveBeenCalled();
  expect(transaction).not.toHaveBeenCalled();
  expect(foreignQuery).not.toHaveBeenCalled();
  expect(foreignTransaction).not.toHaveBeenCalled();
});

function session(id: number) {
  const tx = { id };
  const query = jest.fn(async (_sql: string, options: { transaction: object }) => {
    expect(options.transaction).toBe(tx);
    return [[{ server: 'server', schema: 'slot', session: id }], {}];
  });
  const connection = { query } as unknown as Sequelize;
  const uow: UnitOfWorkPort = { runInTransaction: async (work) => work(tx as never) };
  return { tx, query, connection, uow };
}

test('probes the exact simultaneously held transaction handles around work', async () => {
  const a = session(1);
  const b = session(2);
  const work = jest.fn(async (left, right) => { expect(left).toBe(a.tx); expect(right).toBe(b.tx); });
  await probeConcurrentScopedTransactions(a, b, work);
  expect(work).toHaveBeenCalledTimes(1);
  expect(a.query).toHaveBeenCalledTimes(2);
  expect(b.query).toHaveBeenCalledTimes(2);
});

test('rejects same session or identity drift', async () => {
  const a = session(1);
  const b = session(1);
  const work = jest.fn();
  await expect(probeConcurrentScopedTransactions(a, b, work)).rejects.toThrow();
  expect(work).not.toHaveBeenCalled();
  const c = session(2);
  c.query.mockResolvedValueOnce([[{ server: 'server', schema: 'slot', session: 2 }], {}]);
  c.query.mockResolvedValueOnce([[{ server: 'server', schema: 'slot', session: 3 }], {}]);
  await expect(probeConcurrentScopedTransactions(a, c, work)).rejects.toThrow('session identity drift');
});

test('propagates probe errors and rolls back both entered transactions', async () => {
  const a = session(1);
  const b = session(2);
  const failure = new Error('probe failed');
  a.query.mockRejectedValueOnce(failure);
  const rollbacks = jest.fn();
  for (const slot of [a, b]) {
    const original = slot.uow;
    slot.uow = { runInTransaction: async (work) => {
      try { return await original.runInTransaction(work); }
      catch (error) { rollbacks(); throw error; }
    } };
  }
  const work = jest.fn();
  await expect(probeConcurrentScopedTransactions(a, b, work)).rejects.toBe(failure);
  expect(rollbacks).toHaveBeenCalledTimes(2);
  expect(work).not.toHaveBeenCalled();
});

test('releases an entered transaction when peer acquisition rejects', async () => {
  const a = session(1);
  const b = session(2);
  const failure = new Error('acquisition failed');
  b.uow = { runInTransaction: async () => { throw failure; } };
  const work = jest.fn();
  await expect(probeConcurrentScopedTransactions(a, b, work)).rejects.toBe(failure);
  expect(a.query).not.toHaveBeenCalled();
  expect(work).not.toHaveBeenCalled();
});

test('times out a never-entering peer and rolls back the entered transaction', async () => {
  const a = session(1);
  const b = session(2);
  const events = recordFinalization(a);
  b.uow = { runInTransaction: () => new Promise(() => {}) };
  await expect(probeConcurrentScopedTransactions(a, b, async () => {}, 15)).rejects.toThrow('acquisition timed out');
  expect(events).toEqual(['acquire', 'rollback']);
});

test('a transaction entering after timeout is aborted without work', async () => {
  const a = session(1);
  const b = session(2);
  const events = recordFinalization(b);
  const original = b.uow;
  let enter!: () => void;
  const waiting = new Promise<void>((resolve) => { enter = resolve; });
  b.uow = { runInTransaction: async (work) => { await waiting; return original.runInTransaction(work); } };
  const work = jest.fn();
  await expect(probeConcurrentScopedTransactions(a, b, work, 15)).rejects.toThrow('acquisition timed out');
  enter();
  await new Promise<void>((resolve) => { setImmediate(resolve); });
  expect(events).toEqual(['acquire', 'rollback']);
  expect(work).not.toHaveBeenCalled();
});

function recordFinalization(slot: ReturnType<typeof session>) {
  const events: string[] = [];
  const original = slot.uow;
  slot.uow = { runInTransaction: async (work) => {
    events.push('acquire');
    let result;
    try {
      result = await original.runInTransaction(work);
    } catch (error) {
      events.push('rollback');
      throw error;
    }
    events.push('commit');
    return result;
  } };
  return events;
}

test('left acquisition rejection releases and rolls back the entered right transaction', async () => {
  const a = session(1);
  const b = session(2);
  const failure = new Error('left acquisition failed');
  const rightEvents = recordFinalization(b);
  a.uow = { runInTransaction: async () => { throw failure; } };
  const work = jest.fn();
  await expect(probeConcurrentScopedTransactions(a, b, work)).rejects.toBe(failure);
  expect(rightEvents).toEqual(['acquire', 'rollback']);
  expect(a.query).not.toHaveBeenCalled();
  expect(b.query).not.toHaveBeenCalled();
  expect(work).not.toHaveBeenCalled();
});

test.each([new Error('work failed'), undefined, null, false])('work rejection %s rolls back both and skips post-work probes', async (failure) => {
  const a = session(1);
  const b = session(2);
  const leftEvents = recordFinalization(a);
  const rightEvents = recordFinalization(b);
  const work = jest.fn(async () => { throw failure; });
  await expect(probeConcurrentScopedTransactions(a, b, work)).rejects.toBe(failure);
  expect(work).toHaveBeenCalledTimes(1);
  expect(a.query).toHaveBeenCalledTimes(1);
  expect(b.query).toHaveBeenCalledTimes(1);
  expect(leftEvents).toEqual(['acquire', 'rollback']);
  expect(rightEvents).toEqual(['acquire', 'rollback']);
});

test('after-work probe rejection rolls back both instead of reporting success', async () => {
  const a = session(1);
  const b = session(2);
  const leftEvents = recordFinalization(a);
  const rightEvents = recordFinalization(b);
  const failure = new Error('post-work probe failed');
  b.query.mockImplementationOnce(async () => [[{ server: 'server', schema: 'slot', session: 2 }], {}]);
  b.query.mockRejectedValueOnce(failure);
  const work = jest.fn(async () => {});
  await expect(probeConcurrentScopedTransactions(a, b, work)).rejects.toBe(failure);
  expect(work).toHaveBeenCalledTimes(1);
  expect(a.query).toHaveBeenCalledTimes(2);
  expect(b.query).toHaveBeenCalledTimes(2);
  expect(leftEvents).toEqual(['acquire', 'rollback']);
  expect(rightEvents).toEqual(['acquire', 'rollback']);
});

test('finalization rejection is reported even if the peer already committed', async () => {
  const a = session(1);
  const b = session(2);
  const events: string[] = [];
  let committed!: () => void;
  const leftCommitted = new Promise<void>((resolve) => { committed = resolve; });
  const leftUow = a.uow;
  const rightUow = b.uow;
  const failure = new Error('right finalization failed');
  a.uow = { runInTransaction: async (work) => {
    const result = await leftUow.runInTransaction(work);
    events.push('left commit');
    committed();
    return result;
  } };
  b.uow = { runInTransaction: async (work) => {
    await rightUow.runInTransaction(work);
    await leftCommitted;
    events.push('right finalization rejected');
    throw failure;
  } };
  const work = jest.fn(async () => {});
  await expect(probeConcurrentScopedTransactions(a, b, work)).rejects.toBe(failure);
  expect(work).toHaveBeenCalledTimes(1);
  expect(a.query).toHaveBeenCalledTimes(2);
  expect(b.query).toHaveBeenCalledTimes(2);
  expect(events).toEqual(['left commit', 'right finalization rejected']);
});

describe('refresh-token MySQL fixture safety boundary', () => {
  test('dedicated configuration selects only the explicitly named MySQL suite', () => {
    const config = require('../../../../jest.refresh-sandbox.config');
    expect(config.testMatch).toEqual([
      '**/src/infrastructure/database/__tests__/RefreshTokenSandboxIsolation.mysql.ts',
    ]);
  });
  test('cannot be enabled by caller-supplied session or ownership claims', async () => {
    const { runRefreshTokenMysqlFixture } = require('./refreshTokenIsolationFixture');
    const connect = jest.fn();
    const work = jest.fn();
    await expect(runRefreshTokenMysqlFixture({
      authorized: true,
      expectedUuid: '12345678-1234-1234-1234-123456789abc',
      bound: true,
      connect,
      work,
    })).rejects.toThrow('refresh-token MySQL fixture is disabled');
    expect(connect).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
  });

  test('rejects without configuration before performing any work', async () => {
    const { runRefreshTokenMysqlFixture } = require('./refreshTokenIsolationFixture');
    await expect(runRefreshTokenMysqlFixture()).rejects.toThrow('refresh-token MySQL fixture is disabled');
  });
});
