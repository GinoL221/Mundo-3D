import { DataTypes, Model, ModelCtor, Sequelize } from 'sequelize';

export interface DemoSandboxReleaseSessionAttributes {
  attemptId: string;
  slotId: string;
  generation: number;
  serverUuid: string;
  connectionId: string;
}

export interface DemoSandboxReleaseSessionRecord
  extends Model<DemoSandboxReleaseSessionAttributes>, DemoSandboxReleaseSessionAttributes {}

const releaseSessionModelCache = new WeakMap<Sequelize, ModelCtor<DemoSandboxReleaseSessionRecord>>();

/**
 * Isolated model definition; no table is created or connected here. The record
 * is written on a dedicated connection BEFORE the release transaction starts,
 * so it survives that transaction's rollback: the reader can use it to check
 * whether the recorded connection is gone from the recorded server even when
 * the release itself did not commit. Cached per connection.
 */
export function createDemoSandboxReleaseSessionModel(
  sequelize: Sequelize,
): ModelCtor<DemoSandboxReleaseSessionRecord> {
  const cached = releaseSessionModelCache.get(sequelize);
  if (cached) {
    return cached;
  }
  const model = sequelize.define<DemoSandboxReleaseSessionRecord>(
    'DemoSandboxReleaseSession',
    {
      attemptId: { field: 'attempt_id', type: DataTypes.UUID, allowNull: false, primaryKey: true },
      slotId: { field: 'slot_id', type: DataTypes.STRING(64), allowNull: false },
      generation: { field: 'generation', type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      serverUuid: { field: 'server_uuid', type: DataTypes.UUID, allowNull: false },
      connectionId: { field: 'connection_id', type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    },
    {
      tableName: 'DemoSandboxReleaseSession',
      timestamps: false,
      freezeTableName: true,
      indexes: [
        {
          name: 'uq_release_session_attempt',
          unique: true,
          fields: ['slot_id', 'generation', 'attempt_id'],
        },
      ],
    },
  );
  releaseSessionModelCache.set(sequelize, model);
  return model;
}
