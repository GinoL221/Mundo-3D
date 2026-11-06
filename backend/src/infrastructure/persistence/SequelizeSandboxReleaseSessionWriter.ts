import type { Sequelize } from 'sequelize';
import { UniqueConstraintError } from 'sequelize';
import type { RecordedReleaseSession, SandboxReleaseSessionRecorderPort } from '../../domain/ports/SandboxReleaseSessionRecorderPort';
import type { SandboxReleaseIdentity } from '../../domain/ports/AuthoritativeReleaseStateReaderPort';
import { ReleaseSessionAlreadyRecordedException } from '../../domain/exceptions/ReleaseSessionAlreadyRecordedException';

const SESSION_UNIQUE_INDEX = 'uq_release_session_attempt';

/**
 * Only the attempt-session index or the attempt primary key proves this
 * attempt already recorded a release session. Any other violation or ordinary
 * failure is rethrown unchanged. Sequelize fills `fields` from attribute-level
 * unique keys, so the index name, the individual columns and the attempt
 * primary key are all accepted and nothing else.
 */
function isSessionUniquenessRejection(error: unknown): error is UniqueConstraintError {
  if (!(error instanceof UniqueConstraintError)) return false;
  const rejected = Object.keys(error.fields ?? {});
  if (rejected.length === 1 && (rejected[0] === SESSION_UNIQUE_INDEX || rejected[0] === 'PRIMARY')) return true;
  return rejected.length > 0 && ['slot_id', 'generation', 'attempt_id'].every((field) => rejected.includes(field));
}

/**
 * Unwired adapter for the durable release session record. It captures
 * `CONNECTION_ID()` and `@@server_uuid` on its own connection and inserts the
 * record with bound parameters only, so no identity value reaches the SQL
 * string. The caller is responsible for running the release transaction on
 * this same connection afterwards; nothing here proves that, nor storage
 * uniqueness, grants or retention.
 */
export class SequelizeSandboxReleaseSessionWriter implements SandboxReleaseSessionRecorderPort {
  constructor(
    private readonly connection: Sequelize,
    private readonly slotId: string,
  ) {}

  async recordSession(identity: SandboxReleaseIdentity): Promise<RecordedReleaseSession> {
    if (identity.slotId !== this.slotId) {
      throw new Error('Session slot mismatch');
    }
    const [identityRows] = (await this.connection.query(
      'SELECT CONNECTION_ID() AS id, @@server_uuid AS uuid',
    )) as unknown as [Array<{ id: number; uuid: string }>, unknown];
    const identityRow = identityRows[0];
    if (!identityRow || !Number.isFinite(Number(identityRow.id)) || !identityRow.uuid) {
      throw new Error('Connection identity is unavailable');
    }
    const connectionId = Number(identityRow.id);
    if (!Number.isSafeInteger(connectionId) || connectionId <= 0) {
      throw new Error('Connection identity is unavailable');
    }
    try {
      await this.connection.query(
        'INSERT INTO `DemoSandboxReleaseSession` (attempt_id, slot_id, generation, server_uuid, connection_id) VALUES (:attemptId, :slotId, :generation, :serverUuid, :connectionId)',
        {
          replacements: {
            attemptId: identity.attemptId,
            slotId: identity.slotId,
            generation: identity.generation,
            serverUuid: identityRow.uuid,
            connectionId,
          },
        },
      );
    } catch (error) {
      if (isSessionUniquenessRejection(error)) {
        throw new ReleaseSessionAlreadyRecordedException(identity.slotId, identity.attemptId);
      }
      throw error;
    }
    return {
      attemptId: identity.attemptId,
      slotId: identity.slotId,
      generation: identity.generation,
      serverUuid: identityRow.uuid,
      connectionId: String(connectionId),
    };
  }
}
