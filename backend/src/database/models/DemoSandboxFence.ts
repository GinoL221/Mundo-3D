import { DataTypes, Model, ModelStatic, Sequelize } from 'sequelize';

export interface DemoSandboxFenceAttributes {
  slotId: string;
  leaseId: string | null;
  resetAttemptId: string | null;
  generation: number;
  state: 'open' | 'fenced';
}

export interface DemoSandboxFenceRecord
  extends Model<DemoSandboxFenceAttributes>, DemoSandboxFenceAttributes {}

const fenceModelCache = new WeakMap<Sequelize, ModelStatic<DemoSandboxFenceRecord>>();

/** Isolated model definition; no table is created or connected here. Cached per connection. */
export function createDemoSandboxFenceModel(
  sequelize: Sequelize,
): ModelStatic<DemoSandboxFenceRecord> {
  const cached = fenceModelCache.get(sequelize);
  if (cached) {
    return cached;
  }
  const model = sequelize.define<DemoSandboxFenceRecord>(
    'DemoSandboxFence',
    {
      slotId: { field: 'slot_id', type: DataTypes.STRING(64), allowNull: false, primaryKey: true },
      leaseId: { field: 'lease_id', type: DataTypes.UUID, allowNull: true },
      resetAttemptId: { field: 'reset_attempt_id', type: DataTypes.UUID, allowNull: true },
      generation: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      state: { type: DataTypes.ENUM('open', 'fenced'), allowNull: false },
    },
    { tableName: 'DemoSandboxFence', timestamps: false, freezeTableName: true },
  );
  fenceModelCache.set(sequelize, model);
  return model;
}
