import type { Sequelize } from 'sequelize';
import type {
  AuthoritativeReleaseState,
  AuthoritativeReleaseSessionReaderPort,
  SandboxReleaseIdentity,
} from '../../domain/ports/AuthoritativeReleaseStateReaderPort';

/**
 * The durable identity of the connection that attempted the release, written on
 * a dedicated connection before the release transaction started. It must match
 * the release identity exactly; the reader refuses anything else before any
 * query.
 */
export interface RecordedReleaseSession {
  readonly attemptId: string;
  readonly slotId: string;
  readonly generation: number;
  readonly serverUuid: string;
  readonly connectionId: string;
}

type LifecycleRow = Record<string, string | number | null>;

const qualified = (schema: string, table: string) => `\`${schema}\`.\`${table}\``;

/**
 * Unwired read-only adapter for the authoritative release state. It requires a
 * caller-supplied recorded session, checks the recorded server identity and the
 * recorded connection id against the live server (round-2 evidence: a restart
 * changes the server uuid and recycles low connection ids), then reads the
 * fence under FOR UPDATE as the first statement of one fresh transaction and
 * evaluates the evidence per the reconciliation matrix. It never writes and
 * never retries; every unestablishable condition resolves to null
 * (`indeterminate`). Real grants, topology and multi-process behaviour remain
 * unverified.
 */
export type { AuthoritativeReleaseSessionReaderPort } from '../../domain/ports/AuthoritativeReleaseStateReaderPort';

export class SequelizeAuthoritativeReleaseStateReader implements AuthoritativeReleaseSessionReaderPort {
  constructor(
    private readonly connection: Sequelize,
    private readonly slotId: string,
    private readonly controlSchema = 'control',
    private readonly slotSchema = 'slot',
  ) {}

  async readState(
    identity: SandboxReleaseIdentity,
    session: RecordedReleaseSession,
  ): Promise<AuthoritativeReleaseState | null> {
    if (
      session.attemptId !== identity.attemptId ||
      session.slotId !== identity.slotId ||
      session.slotId !== this.slotId ||
      session.generation !== identity.generation
    ) {
      return null;
    }
    try {
      const [uuidRows] = (await this.connection.query(
        'SELECT @@server_uuid AS current',
      )) as unknown as [Array<{ current: string }>, unknown];
      if (!uuidRows[0] || uuidRows[0].current !== session.serverUuid) {
        return null;
      }
      const [processRows] = (await this.connection.query(
        'SELECT ID FROM information_schema.PROCESSLIST WHERE ID = ?',
        { replacements: [Number(session.connectionId)] },
      )) as unknown as [Array<{ ID: number }>, unknown];
      if (processRows.length > 0) {
        return null;
      }
      return await this.connection.transaction(async (transaction) => {
        const fence = await this.lifecycleRow(
          `SELECT slot_id, state, generation, lease_id, reset_attempt_id FROM ${qualified(this.slotSchema, 'DemoSandboxFence')} WHERE slot_id = '${escapeQuote(identity.slotId)}' FOR UPDATE`,
          transaction,
        );
        const control = await this.lifecycleRow(
          `SELECT slot_id, status, generation, lease_id, reset_attempt_id FROM ${qualified(this.controlSchema, 'DemoSandboxSlot')} WHERE slot_id = '${escapeQuote(identity.slotId)}' FOR UPDATE`,
          transaction,
        );
        const receipt = await this.lifecycleRow(
          `SELECT slot_id, generation, attempt_id, seed_version, consumed FROM ${qualified(this.slotSchema, 'DemoSandboxResetReceipt')} WHERE slot_id = '${escapeQuote(identity.slotId)}' AND generation = ${identity.generation} AND attempt_id = '${escapeQuote(identity.attemptId)}' FOR UPDATE`,
          transaction,
        );
        const [releaseRows] = (await this.connection.query(
          `SELECT release_id, slot_id, generation, attempt_id, seed_version, lease_id FROM ${qualified(this.slotSchema, 'DemoSandboxReleaseOperation')} WHERE release_id = '${escapeQuote(identity.releaseId)}'`,
          { transaction: transaction as unknown as never },
        )) as unknown as [Array<LifecycleRow>, unknown];
        const releaseRow = releaseRows[0] ?? null;
        return {
          transactionEnded: true,
          authoritativeSnapshot: true,
          releaseEvidence: { identity, outcome: releaseRow === null ? 'not_committed' : 'committed' },
          control: projectControl(control),
          fence: projectFence(fence),
          receipt: projectReceipt(receipt),
        };
      });
    } catch {
      return null;
    }
  }

  private async lifecycleRow(sql: string, transaction: unknown): Promise<LifecycleRow | null> {
    const [rows] = (await this.connection.query(sql, {
      transaction: transaction as unknown as never,
    })) as unknown as [Array<LifecycleRow>, unknown];
    return rows[0] ?? null;
  }
}

function escapeQuote(value: string): string {
  return value.replace(/'/g, "''");
}

function projectControl(row: LifecycleRow | null): AuthoritativeReleaseState['control'] {
  if (!row) return null;
  return {
    slotId: String(row.slot_id),
    status: String(row.status) as NonNullable<AuthoritativeReleaseState['control']>['status'],
    generation: Number(row.generation),
    leaseId: row.lease_id === null ? null : String(row.lease_id),
    resetAttemptId: row.reset_attempt_id === null ? null : String(row.reset_attempt_id),
  };
}

function projectFence(row: LifecycleRow | null): AuthoritativeReleaseState['fence'] {
  if (!row) return null;
  return {
    slotId: String(row.slot_id),
    state: String(row.state) as NonNullable<AuthoritativeReleaseState['fence']>['state'],
    generation: Number(row.generation),
    leaseId: row.lease_id === null ? null : String(row.lease_id),
    resetAttemptId: row.reset_attempt_id === null ? null : String(row.reset_attempt_id),
  };
}

function projectReceipt(row: LifecycleRow | null): AuthoritativeReleaseState['receipt'] {
  if (!row) return null;
  return {
    slotId: String(row.slot_id),
    generation: Number(row.generation),
    attemptId: String(row.attempt_id),
    seedVersion: String(row.seed_version),
    consumed: Number(row.consumed) === 1,
  };
}
