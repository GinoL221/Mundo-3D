import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import type { RememberToken } from '../../../domain/entities/RememberToken';
import type { RememberTokenRepositoryPort } from '../../../domain/ports/RememberTokenRepositoryPort';
import type { UnitOfWorkPort } from '../../../domain/ports/UnitOfWorkPort';

type Repository = Pick<RememberTokenRepositoryPort, 'findByHash' | 'claimRotation' | 'insertSuccessor'>;
type Slot = { repository: Repository; uow: UnitOfWorkPort };

export interface LogicalTokenRow {
  tokenHash: string;
  idUser: number;
  familyId: string | null;
  expiryDate: string;
  superseded: boolean;
  successorHash: string | null;
  revoked: boolean;
}

type SlotSnapshot = { rows: LogicalTokenRow[]; counters: unknown };

/** Snapshots must be detached, ordered by tokenHash, and include allocator counters separately. */
export interface RefreshTokenScenarioInputs {
  acquisitionTimeoutMs?: number;
  a: Slot;
  aConcurrent: Slot;
  b: Slot;
  fixtures: {
    aHash: string;
    bHash: string;
    rollbackHash: string;
    raceHash: string;
    rollbackSuccessor: RememberToken;
    raceSuccessors: [RememberToken, RememberToken];
  };
  snapshot: () => Promise<{ a: SlotSnapshot; b: SlotSnapshot; control: { rows: unknown; counters: unknown } }>;
  /** Trusted fixture must independently verify and bind these physical sessions to both UoWs for the entire run. */
  verifySessions: () => Promise<{ server: string; schema: string; concurrentServer: string; concurrentSchema: string; session: string; concurrentSession: string; bound: boolean }>;
}

export async function runRefreshTokenIsolationScenarios(input: RefreshTokenScenarioInputs): Promise<void> {
  const { a, aConcurrent, b, fixtures, snapshot } = input;
  const acquisitionTimeoutMs = input.acquisitionTimeoutMs ?? 5000;
  if (!Number.isFinite(acquisitionTimeoutMs) || acquisitionTimeoutMs <= 0) throw new Error('invalid acquisition timeout');
  ok(typeof input.verifySessions === 'function', 'trusted session verification is required');
  const evidence = await input.verifySessions();
  ok(evidence && evidence.bound === true && evidence.server && evidence.schema && evidence.session && evidence.concurrentSession && evidence.server === evidence.concurrentServer && evidence.schema === evidence.concurrentSchema && evidence.session !== evidence.concurrentSession, 'independent same-schema bound session evidence required');
  const hashes = [fixtures.aHash, fixtures.bHash, fixtures.rollbackHash, fixtures.raceHash, fixtures.rollbackSuccessor.tokenHash, ...fixtures.raceSuccessors.map((row) => row.tokenHash)];
  strictEqual(new Set(hashes).size, hashes.length, 'fixture hashes must be distinct');
  ok(await a.repository.findByHash(fixtures.aHash));
  ok(await b.repository.findByHash(fixtures.bHash));
  strictEqual(await a.repository.findByHash(fixtures.bHash), null, 'A must not read B');
  strictEqual(await b.repository.findByHash(fixtures.aHash), null, 'B must not read A');

  const beforeForeign = await snapshot();
  await b.uow.runInTransaction(async (tx) => {
    let rejection: unknown;
    try { await a.repository.claimRotation({ presentedHash: fixtures.aHash, successorHash: fixtures.rollbackSuccessor.tokenHash, tx }); }
    catch (error) { rejection = error; }
    ok(rejection instanceof Error && rejection.message === 'Transaction context is not active for this connection', 'foreign transaction must be rejected by the scoped repository');
  });
  deepStrictEqual(await snapshot(), beforeForeign, 'foreign transaction must not mutate state');

  const beforeRollback = await snapshot();
  const rollback = new Error('intentional rollback');
  let caught: unknown;
  try {
    await a.uow.runInTransaction(async (tx) => {
      ok(await a.repository.claimRotation({ presentedHash: fixtures.rollbackHash, successorHash: fixtures.rollbackSuccessor.tokenHash, tx }));
      await a.repository.insertSuccessor(fixtures.rollbackSuccessor, tx);
      throw rollback;
    });
  } catch (error) { caught = error; }
  strictEqual(caught, rollback, 'rollback must propagate the deliberate error');
  const afterRollback = await snapshot();
  deepStrictEqual(afterRollback.a.rows, beforeRollback.a.rows, 'rollback must restore A logical rows');
  deepStrictEqual(afterRollback.b, beforeRollback.b, 'rollback must not mutate B');
  deepStrictEqual(afterRollback.control, beforeRollback.control, 'rollback must not mutate control');
  // MySQL can consume an AUTO_INCREMENT value even when the insert rolls back.

  const original = await a.repository.findByHash(fixtures.raceHash);
  ok(original && original.familyId, 'race fixture requires a family');
  for (const successor of fixtures.raceSuccessors) {
    strictEqual(successor.familyId, original.familyId, 'successor must share the family');
    strictEqual(successor.idUser, original.idUser, 'successor must share the user');
    strictEqual(successor.expiryDate.getTime(), original.expiryDate.getTime(), 'successor must inherit expiry');
    strictEqual(await a.repository.findByHash(successor.tokenHash), null, 'successor must be fresh');
  }
  let arrivals = 0;
  let release!: () => void;
  let acquisitionFailure: unknown;
  let acquisitionFailed = false;
  const aborted = new Error('claim aborted after peer acquisition failure');
  const loser = new Error('claim lost; roll back');
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const claim = (slot: Slot, successor: RememberToken) => {
    let entered = false;
    return Promise.resolve().then(() => slot.uow.runInTransaction(async (tx) => {
      entered = true;
      arrivals += 1;
      if (arrivals === 2) { clearTimeout(timer); release(); }
      await gate;
      if (acquisitionFailed) throw aborted;
      const won = await slot.repository.claimRotation({ presentedHash: fixtures.raceHash, successorHash: successor.tokenHash, tx });
      if (!won) throw loser;
      await slot.repository.insertSuccessor(successor, tx);
      return true;
    })).catch((error: unknown) => {
      if (!entered) { if (!acquisitionFailed) acquisitionFailure = error; acquisitionFailed = true; release(); }
      throw error;
    });
  };
  let timeout!: (error: Error) => void;
  const timedOut = new Promise<never>((_resolve, reject) => { timeout = reject; });
  const timer = setTimeout(() => {
    if (!acquisitionFailed) acquisitionFailure = new Error('transaction acquisition timed out');
    acquisitionFailed = true;
    release();
    timeout(acquisitionFailure instanceof Error ? acquisitionFailure : new Error('transaction acquisition timed out'));
  }, acquisitionTimeoutMs);
  const all = Promise.allSettled([claim(a, fixtures.raceSuccessors[0]), claim(aConcurrent, fixtures.raceSuccessors[1])]);
  let results: Awaited<typeof all>;
  try { results = await Promise.race([all, timedOut]); } finally { clearTimeout(timer); }
  if (acquisitionFailed) throw acquisitionFailure;
  for (const result of results) if (result.status === 'rejected' && result.reason !== loser) throw result.reason;
  strictEqual(results.filter((result) => result.status === 'rejected' && result.reason === loser).length, 1, 'exactly one claim must lose and roll back');
  const wins = results.map((result) => result.status === 'fulfilled' && result.value);
  strictEqual(wins.filter(Boolean).length, 1, 'exactly one claim must win');
  const winningSuccessor = fixtures.raceSuccessors[wins[0] ? 0 : 1];
  const losingSuccessor = fixtures.raceSuccessors[wins[0] ? 1 : 0];
  const updated = await a.repository.findByHash(fixtures.raceHash);
  ok(updated?.supersededAt, 'winning claim must supersede original');
  strictEqual(updated.successorHash, winningSuccessor.tokenHash);
  const inserted = await a.repository.findByHash(winningSuccessor.tokenHash);
  ok(inserted, 'winning successor must be persisted');
  strictEqual(inserted.familyId, original.familyId);
  strictEqual(inserted.idUser, original.idUser);
  strictEqual(inserted.expiryDate.getTime(), original.expiryDate.getTime());
  strictEqual(await a.repository.findByHash(losingSuccessor.tokenHash), null);
  const after = await snapshot();
  const originalRow = afterRollback.a.rows.find((row) => row.tokenHash === fixtures.raceHash);
  ok(originalRow && !originalRow.superseded && originalRow.successorHash === null && !originalRow.revoked, 'race snapshot must contain a current original');
  const expectedRows = afterRollback.a.rows.map((row) => row.tokenHash === fixtures.raceHash
    ? { ...row, superseded: true, successorHash: winningSuccessor.tokenHash }
    : row);
  expectedRows.push({ tokenHash: winningSuccessor.tokenHash, idUser: winningSuccessor.idUser, familyId: winningSuccessor.familyId ?? null, expiryDate: winningSuccessor.expiryDate.toISOString(), superseded: false, successorHash: null, revoked: false });
  expectedRows.sort((left, right) => left.tokenHash < right.tokenHash ? -1 : left.tokenHash > right.tokenHash ? 1 : 0);
  deepStrictEqual(after.a.rows, expectedRows, 'race must produce exactly the expected A logical rows');
  deepStrictEqual(after.b, afterRollback.b, 'race must not mutate B');
  deepStrictEqual(after.control, afterRollback.control, 'race must not mutate control');
}
