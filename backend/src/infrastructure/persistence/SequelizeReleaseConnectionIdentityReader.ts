import type { Sequelize } from 'sequelize';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import type { ReleaseConnectionIdentityReader, LiveConnectionIdentity } from '../database/CoordinateSandboxRelease';

/**
 * Unwired adapter reading the live identity of the raw connection a
 * transaction is running on. The coordinator's continuity guard compares this
 * snapshot against the recorded release session; nothing here proves the
 * deployment topology or that the caller holds a dedicated connection.
 */
export class SequelizeReleaseConnectionIdentityReader implements ReleaseConnectionIdentityReader {
  constructor(private readonly connection: Sequelize) {}

  async snapshot(context: TransactionContext): Promise<LiveConnectionIdentity> {
    const [rows] = (await this.connection.query(
      'SELECT CONNECTION_ID() AS id, @@server_uuid AS uuid',
      { transaction: context as unknown as never },
    )) as unknown as [Array<{ id: number; uuid: string }>, unknown];
    const row = rows[0];
    const connectionId = Number(row?.id);
    // Same strict mapping the session writer uses, so both sides agree on what
    // a comparable thread id is: a positive safe integer and nothing else.
    if (
      !row ||
      !/^\s*[0-9]+\s*$/.test(String(row.id)) ||
      !Number.isSafeInteger(connectionId) ||
      connectionId <= 0 ||
      !row.uuid
    ) {
      throw new Error('Connection identity is unavailable');
    }
    return {
      connectionId: String(connectionId),
      serverUuid: row.uuid,
    };
  }
}
