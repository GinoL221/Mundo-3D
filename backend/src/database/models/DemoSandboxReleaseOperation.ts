import { DataTypes, Model, ModelCtor, Sequelize } from 'sequelize';

export interface DemoSandboxReleaseOperationAttributes {
  releaseId: string;
  slotId: string;
  generation: number;
  attemptId: string;
  seedVersion: string;
  leaseId: string;
}

export interface DemoSandboxReleaseOperationRecord
  extends Model<DemoSandboxReleaseOperationAttributes>, DemoSandboxReleaseOperationAttributes {}

const releaseOperationModelCache = new WeakMap<
  Sequelize,
  ModelCtor<DemoSandboxReleaseOperationRecord>
>();

/**
 * Isolated model definition; no table is created or connected here. A row only
 * exists after the release transaction committed, so it is evidence only when
 * it is written in that same transaction. Cached per connection.
 */
export function createDemoSandboxReleaseOperationModel(
  sequelize: Sequelize,
): ModelCtor<DemoSandboxReleaseOperationRecord> {
  const cached = releaseOperationModelCache.get(sequelize);
  if (cached) {
    return cached;
  }
  const model = sequelize.define<DemoSandboxReleaseOperationRecord>(
    'DemoSandboxReleaseOperation',
    {
      releaseId: {
        field: 'release_id',
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      slotId: { field: 'slot_id', type: DataTypes.STRING(64), allowNull: false },
      generation: { field: 'generation', type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      attemptId: { field: 'attempt_id', type: DataTypes.UUID, allowNull: false },
      seedVersion: { field: 'seed_version', type: DataTypes.STRING(128), allowNull: false },
      leaseId: { field: 'lease_id', type: DataTypes.UUID, allowNull: false },
    },
    { tableName: 'DemoSandboxReleaseOperation', timestamps: false, freezeTableName: true },
  );
  releaseOperationModelCache.set(sequelize, model);
  return model;
}
