import { RememberToken } from '../../../domain/entities/RememberToken';
import { runRefreshTokenIsolationScenarios } from './refreshTokenIsolationScenarios';
import type { RefreshTokenScenarioInputs } from './refreshTokenIsolationScenarios';

function fixture(broken: 'none' | 'read' | 'foreign' | 'foreign-mutates' | 'race' | 'rollback' = 'none'): RefreshTokenScenarioInputs {
  const expiry = new Date('2099-01-01T00:00:00Z');
  const token = (hash: string) => new RememberToken(1, hash, 1, expiry, null, 'family');
  const rows = { a: ['a', 'rollback', 'race'], b: ['b'] };
  let winner = false;
  let raceSuccessor = '';
  let counter = 4;
  const make = (slot: 'a' | 'b') => ({
    findByHash: async (hash: string) => {
      if (!rows[slot].includes(hash) && !(broken === 'read' && hash === 'b' && slot === 'a')) return null;
      if (hash === 'race' && winner) return new RememberToken(1, hash, 1, expiry, null, 'family', new Date(), raceSuccessor);
      return token(hash);
    },
    claimRotation: async ({ presentedHash, successorHash, tx }: { presentedHash: string; successorHash: string; tx: object }) => {
      if (!(tx as { slot: string }).slot.startsWith(slot) && broken !== 'foreign') {
        if (broken === 'foreign-mutates') rows[slot].push('foreign mutation');
        throw new Error('Transaction context is not active for this connection');
      }
      if (presentedHash === 'race') {
        if (winner && broken !== 'race') return false;
        winner = true;
        raceSuccessor = successorHash;
      }
      rows[slot].push(`claimed:${presentedHash}`);
      return true;
    },
    insertSuccessor: async (row: RememberToken) => { counter++; rows[slot].push(row.tokenHash); return row; },
  });
  const uow = (slot: 'a' | 'b', id: string) => ({
    runInTransaction: async <T>(work: (tx: never) => Promise<T>): Promise<T> => {
      const before = [...rows[slot]];
      try { return await work({ slot: `${slot}${id}` } as never); }
      catch (error) { if (broken !== 'rollback' && !(error instanceof Error && error.message === 'claim lost; roll back')) rows[slot] = before; throw error; }
    },
  });
  return {
    a: { repository: make('a'), uow: uow('a', '1') },
    aConcurrent: { repository: make('a'), uow: uow('a', '2') },
    b: { repository: make('b'), uow: uow('b', '1') },
    fixtures: { aHash: 'a', bHash: 'b', rollbackHash: 'rollback', raceHash: 'race', rollbackSuccessor: token('rollback-next'), raceSuccessors: [token('next1'), token('next2')] },
    verifySessions: async () => ({ server: 'server', concurrentServer: 'server', schema: 'a', concurrentSchema: 'a', session: '1', concurrentSession: '2', bound: true }),
    snapshot: async () => {
      const logical = (slot: 'a' | 'b') => rows[slot].filter((hash) => !hash.startsWith('claimed:')).sort().map((hash) => ({ tokenHash: hash, idUser: 1, familyId: 'family', expiryDate: expiry.toISOString(), superseded: rows[slot].includes(`claimed:${hash}`), successorHash: hash === 'race' && winner ? raceSuccessor : null, revoked: false }));
      return { a: { rows: logical('a'), counters: counter }, b: { rows: logical('b'), counters: 2 }, control: { rows: [7], counters: 1 } };
    },
  };
}

test('accepts isolated repositories with rollback and one concurrent winner', async () => {
  const input = fixture();
  const before = await input.snapshot();
  await expect(runRefreshTokenIsolationScenarios(input)).resolves.toBeUndefined();
  const after = await input.snapshot();
  expect(after.a.counters).toBe(6); // rolled-back insert still consumes an allocator value
  expect(after.b).toEqual(before.b);
  expect(after.control).toEqual(before.control);
});

test.each(['read', 'foreign', 'foreign-mutates', 'race', 'rollback'] as const)('detects broken %s behavior', async (broken) => {
  await expect(runRefreshTokenIsolationScenarios(fixture(broken))).rejects.toThrow();
});

test('releases the entered transaction when the second acquisition fails', async () => {
  const input = fixture();
  const failure = new Error('acquisition failed');
  let exits = 0;
  const original = input.a.uow;
  input.a.uow = { runInTransaction: async (work) => {
    try { return await original.runInTransaction(work); } finally { exits++; }
  } };
  input.aConcurrent.uow = { runInTransaction: async () => { throw failure; } };
  await expect(runRefreshTokenIsolationScenarios(input)).rejects.toBe(failure);
  expect(exits).toBe(2); // rollback scenario and aborted concurrent transaction
}, 1000);

test('times out a never-entering race peer and rolls back the entered transaction', async () => {
  const input = fixture();
  input.acquisitionTimeoutMs = 15;
  let exits = 0;
  const original = input.a.uow;
  input.a.uow = { runInTransaction: async (work) => {
    try { return await original.runInTransaction(work); } finally { exits++; }
  } };
  input.aConcurrent.uow = { runInTransaction: () => new Promise(() => {}) };
  await expect(runRefreshTokenIsolationScenarios(input)).rejects.toThrow('acquisition timed out');
  expect(exits).toBe(2);
});

test('race winner commits before a row-locked loser can finish', async () => {
  const input = fixture();
  let release!: () => void;
  const committed = new Promise<void>((resolve) => { release = resolve; });
  const winner = input.a.uow;
  let count = 0;
  input.a.uow = { runInTransaction: async (work) => {
    const result = await winner.runInTransaction(work);
    if (++count === 1) release();
    return result;
  } };
  const claim = input.aConcurrent.repository.claimRotation;
  input.aConcurrent.repository.claimRotation = async (args) => {
    await committed;
    return claim(args);
  };
  await expect(runRefreshTokenIsolationScenarios(input)).resolves.toBeUndefined();
});

test('detects an unrelated A-row mutation during the race', async () => {
  const input = fixture();
  const original = input.snapshot;
  let snapshots = 0;
  input.snapshot = async () => {
    const result = await original();
    if (++snapshots === 5) result.a.rows[0].idUser = 999;
    return result;
  };
  await expect(runRefreshTokenIsolationScenarios(input)).rejects.toThrow('race must produce exactly the expected A logical rows');
});

test('fails closed without distinct bound session evidence before reading', async () => {
  const input = fixture();
  input.verifySessions = async () => ({ server: 'server', concurrentServer: 'server', schema: 'a', concurrentSchema: 'a', session: '1', concurrentSession: '1', bound: true });
  const read = jest.spyOn(input.a.repository, 'findByHash');
  await expect(runRefreshTokenIsolationScenarios(input)).rejects.toThrow('independent same-schema bound session evidence required');
  expect(read).not.toHaveBeenCalled();
});

test('rolls back the losing claim rather than committing it', async () => {
  const input = fixture();
  let rejected = 0;
  for (const slot of [input.a, input.aConcurrent]) {
    const original = slot.uow;
    slot.uow = { runInTransaction: async (work) => {
      try { return await original.runInTransaction(work); }
      catch (error) { rejected++; throw error; }
    } };
  }
  await runRefreshTokenIsolationScenarios(input);
  expect(rejected).toBe(2); // deliberate rollback plus the losing claim
});
