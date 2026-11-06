import { DataTypes, Model, ModelCtor, Sequelize } from 'sequelize';

export interface DemoSandboxResetReceiptAttributes {
  attemptId: string;
  slotId: string;
  generation: number;
  seedVersion: string;
  consumed: boolean;
}

export interface DemoSandboxResetReceiptRecord
  extends Model<DemoSandboxResetReceiptAttributes>, DemoSandboxResetReceiptAttributes {}

/** Model declaration only; no schema, migration or connection is created. */
export function createDemoSandboxResetReceiptModel(
  sequelize: Sequelize,
): ModelCtor<DemoSandboxResetReceiptRecord> {
  return sequelize.define<DemoSandboxResetReceiptRecord>(
    'DemoSandboxResetReceipt',
    {
      attemptId: { field: 'attempt_id', type: DataTypes.UUID, allowNull: false, primaryKey: true },
      slotId: { field: 'slot_id', type: DataTypes.STRING(64), allowNull: false },
      generation: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      seedVersion: { field: 'seed_version', type: DataTypes.STRING(128), allowNull: false },
      consumed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: 'DemoSandboxResetReceipt', timestamps: false, freezeTableName: true },
  );
}
