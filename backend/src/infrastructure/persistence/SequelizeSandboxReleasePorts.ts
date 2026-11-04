import type { Sequelize } from 'sequelize';
import type { SandboxReleaseIdentity } from '../../domain/ports/AuthoritativeReleaseStateReaderPort';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import type {
  SandboxReleaseControl,
  SandboxReleaseFence,
} from '../../application/use-cases/ReleaseSandboxInTransaction';
import { resolveScopedTransaction } from './scopedTransactionContext';

type Row = Record<string, string | number | null>;

/**
 * Unwired in-transaction adapters for the single-transaction release seam.
 * Both require an active same-connection transaction and use operator-supplied
 * schema names (never caller input). They do not open, commit or roll back
 * anything, and they prove nothing about grants, isolation or lock behaviour on
 * a real server: a coordinator principal able to touch both schemas is not
 * designed or authorised yet.
 */
export class SequelizeSandboxReleaseControl implements SandboxReleaseControl {
  constructor(
    private readonly connection: Sequelize,
    private readonly slotId: string,
    private readonly controlSchema: string,
    private readonly slotSchema: string,
  ) {}

  private transaction(identity: SandboxReleaseIdentity, context: TransactionContext) {
    const transaction = resolveScopedTransaction(context, this.connection);
    if (!transaction) throw new Error('Transaction context is required');
    if (identity.slotId !== this.slotId) throw new Error('Sandbox release slot mismatch');
    return transaction;
  }

  async lockAndCheck(identity: SandboxReleaseIdentity, context: TransactionContext): Promise<boolean> {
    if (identity.slotId !== this.slotId) return false;
    const transaction = this.transaction(identity, context);
    const [rows] = (await this.connection.query(
      `SELECT slot_id, status, generation, lease_id, reset_attempt_id FROM \`${this.controlSchema}\`.\`DemoSandboxSlot\` WHERE slot_id = ? FOR UPDATE`,
      { replacements: [identity.slotId], transaction: transaction as unknown as never },
    )) as unknown as [Row[], unknown];
    const row = rows[0];
    return (
      row !== undefined &&
      row.slot_id === identity.slotId &&
      row.status === 'resetting' &&
      Number(row.generation) === identity.generation &&
      row.lease_id === identity.leaseId &&
      row.reset_attempt_id === identity.attemptId
    );
  }

  /**
   * Advances control and fence together. Both updates carry the full
   * compare-and-swap predicate, so a row that changed after the locks cannot be
   * advanced by this transaction.
   */
  async release(identity: SandboxReleaseIdentity, context: TransactionContext): Promise<boolean> {
    const transaction = this.transaction(identity, context);
    const guard = `WHERE slot_id = ? AND generation = ? AND reset_attempt_id = ?`;
    const replacements = [identity.slotId, identity.generation, identity.attemptId];

    const [controlResult] = (await this.connection.query(
      `UPDATE \`${this.controlSchema}\`.\`DemoSandboxSlot\` SET status = 'available', generation = generation + 1, lease_id = NULL, reset_attempt_id = NULL ${guard} AND status = 'resetting' AND lease_id = ?`,
      {
        replacements: [...replacements, identity.leaseId],
        transaction: transaction as unknown as never,
      },
    )) as unknown as [{ affectedRows?: number }, unknown];
    if (!controlResult || Number(controlResult.affectedRows) !== 1) return false;

    const [fenceResult] = (await this.connection.query(
      `UPDATE \`${this.slotSchema}\`.\`DemoSandboxFence\` SET state = 'open', generation = generation + 1, lease_id = NULL, reset_attempt_id = NULL ${guard} AND state = 'fenced'`,
      { replacements, transaction: transaction as unknown as never },
    )) as unknown as [{ affectedRows?: number }, unknown];
    return fenceResult !== undefined && Number(fenceResult.affectedRows) === 1;
  }
}

/** Locks and validates the slot fence row after the control row. */
export class SequelizeSandboxReleaseFence implements SandboxReleaseFence {
  constructor(
    private readonly connection: Sequelize,
    private readonly slotId: string,
    private readonly slotSchema: string,
  ) {}

  async lockAndCheck(identity: SandboxReleaseIdentity, context: TransactionContext): Promise<boolean> {
    if (identity.slotId !== this.slotId) return false;
    const transaction = resolveScopedTransaction(context, this.connection);
    if (!transaction) throw new Error('Transaction context is required');
    const [rows] = (await this.connection.query(
      `SELECT slot_id, state, generation, reset_attempt_id FROM \`${this.slotSchema}\`.\`DemoSandboxFence\` WHERE slot_id = ? FOR UPDATE`,
      { replacements: [identity.slotId], transaction: transaction as unknown as never },
    )) as unknown as [Row[], unknown];
    const row = rows[0];
    return (
      row !== undefined &&
      row.slot_id === identity.slotId &&
      row.state === 'fenced' &&
      Number(row.generation) === identity.generation &&
      row.reset_attempt_id === identity.attemptId
    );
  }
}
