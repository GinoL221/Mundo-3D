import { RememberToken } from '../entities/RememberToken';
import { TransactionContext } from './UnitOfWorkPort';

export interface RememberTokenRepositoryPort {
  create(token: Omit<RememberToken, 'idRememberToken'>): Promise<RememberToken>;
  findByHash(hash: string): Promise<RememberToken | null>;
  deleteByHash(hash: string): Promise<boolean>;

  // Rotation operations (HIGH-1 PR1, design.md D1/D2/D7).
  //
  // The authoritative claim gate: one conditional UPDATE, tx-scoped.
  // `false` means the caller lost the race (or the row is no longer
  // current) — the transaction must be rolled back and the caller must
  // re-read the row OUTSIDE the aborted transaction.
  claimRotation(input: {
    presentedHash: string;
    successorHash: string;
    tx: TransactionContext;
  }): Promise<boolean>;

  // Inserts the successor row (same family, same user, inherited expiry).
  insertSuccessor(row: RememberToken, tx: TransactionContext): Promise<RememberToken>;

  // Marks every row in the family revoked (logout). Not tx-scoped by
  // design — a single UPDATE is already atomic and this runs outside any
  // rotation transaction.
  revokeFamily(familyId: string): Promise<number>;

  // Deletes rows in the family superseded longer ago than the retention
  // cutoff. That cutoff is independent of the grace window: grace decides
  // whether a superseded token still authenticates, retention decides how
  // long its row survives as reuse-detection evidence.
  reapFamily(familyId: string, retentionSeconds: number, tx: TransactionContext): Promise<number>;
}
