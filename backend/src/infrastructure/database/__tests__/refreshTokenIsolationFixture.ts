import type { Sequelize, Transaction } from 'sequelize';
import type { TransactionContext, UnitOfWorkPort } from '../../../domain/ports/UnitOfWorkPort';
import { ScopedSequelizeUnitOfWork } from '../../persistence/ScopedSequelizeUnitOfWork';
import { ScopedSequelizeRememberTokenRepository } from '../../repositories/ScopedSequelizeRememberTokenRepository';
import type { RememberTokenPersistence } from '../../repositories/ScopedSequelizeRememberTokenRepository';

type ScopedSession = { connection: Sequelize; uow: UnitOfWorkPort };
type Identity = { server: string; schema: string; session: number };

/** Construct adapters only; matching Sequelize objects do not prove resource
 * ownership or physical-session continuity.
 */
export function createScopedRefreshTokenAdapters(db: RememberTokenPersistence) {
  if (!db.RememberToken.sequelize || db.RememberToken.sequelize !== db.sequelize) {
    throw new Error('RememberToken model must be bound to the supplied connection');
  }
  return {
    repository: new ScopedSequelizeRememberTokenRepository(db),
    uow: new ScopedSequelizeUnitOfWork(db.sequelize),
  };
}

async function identity(connection: Sequelize, tx: TransactionContext): Promise<Identity> {
  const [rows] = await connection.query(
    'SELECT @@server_uuid AS server, DATABASE() AS `schema`, CONNECTION_ID() AS session',
    { transaction: tx as unknown as Transaction },
  );
  const row = (rows as unknown as Identity[])[0];
  if (!row || typeof row.server !== 'string' || !row.server || typeof row.schema !== 'string' || !row.schema || !Number.isSafeInteger(row.session) || row.session <= 0) {
    throw new Error('invalid transaction session identity');
  }
  return row;
}

/**
 * Preparation primitive only: supplied UoWs and connections must already be scoped.
 * Probes observe the transaction handles before and after work; they do not prove
 * ownership, uninterrupted physical binding, or authorize use of any resource.
 * A non-settling acquisition cannot be cancelled; a late entry is aborted.
 * Do not wrap a lock-contended race in this paired-work probe: neither
 * transaction can commit until work has finished on both handles.
 * Finalization is independent, not atomic: one transaction may commit before its peer's
 * finalization fails. A rejected finalization has an uncertain outcome.
 */
export async function probeConcurrentScopedTransactions(
  left: ScopedSession,
  right: ScopedSession,
  work: (left: TransactionContext, right: TransactionContext) => Promise<void>,
  acquisitionTimeoutMs = 5000,
): Promise<void> {
  if (!Number.isFinite(acquisitionTimeoutMs) || acquisitionTimeoutMs <= 0) throw new Error('invalid acquisition timeout');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const handles: TransactionContext[] = [];
  let failure: unknown;
  let failed = false;
  const run = (slot: ScopedSession, index: number) => {
    let entered = false;
    return Promise.resolve().then(() => slot.uow.runInTransaction(async (tx) => {
      entered = true;
      handles[index] = tx;
      if (handles[0] && handles[1]) { clearTimeout(timer); release(); }
      await gate;
      if (failed) throw failure;
      if (index === 0) {
        try {
          const before = await Promise.all([identity(left.connection, handles[0]), identity(right.connection, handles[1])]);
          if (before[0].server !== before[1].server || before[0].schema !== before[1].schema || before[0].session === before[1].session) throw new Error('independent same-schema sessions required');
          await work(handles[0], handles[1]);
          const after = await Promise.all([identity(left.connection, handles[0]), identity(right.connection, handles[1])]);
          if (before.some((item, i) => item.server !== after[i].server || item.schema !== after[i].schema || item.session !== after[i].session)) throw new Error('session identity drift');
        } catch (error) { failed = true; failure = error; }
        releaseWork();
      } else {
        await workDone;
      }
      if (failed) throw failure;
    })).catch((error: unknown) => {
      if (!entered) { if (!failed) failure = error; failed = true; release(); releaseWork(); }
      throw error;
    });
  };
  let releaseWork!: () => void;
  const workDone = new Promise<void>((resolve) => { releaseWork = resolve; });
  let timeout!: (error: Error) => void;
  const timedOut = new Promise<never>((_resolve, reject) => { timeout = reject; });
  const timer = setTimeout(() => {
    if (!failed) { failure = new Error('transaction acquisition timed out'); failed = true; }
    release();
    releaseWork();
    timeout(failure instanceof Error ? failure : new Error('transaction acquisition timed out'));
  }, acquisitionTimeoutMs);
  const all = Promise.allSettled([run(left, 0), run(right, 1)]);
  let results: Awaited<typeof all>;
  try { results = await Promise.race([all, timedOut]); } finally { clearTimeout(timer); }
  if (failed) throw failure;
  for (const result of results) if (result.status === 'rejected') throw result.reason;
}

/**
 * Deliberately non-operational. Caller-supplied callbacks, identifiers or
 * authorization flags cannot establish container ownership or bind a Sequelize
 * transaction to a verified physical MySQL session. No connection, model or
 * scenario is created here until those guarantees are independently enforced.
 */
export async function runRefreshTokenMysqlFixture(_untrusted?: unknown): Promise<never> {
  throw new Error('refresh-token MySQL fixture is disabled: independent endpoint and physical-session binding are not proven');
}
