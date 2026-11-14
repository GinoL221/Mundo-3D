import { DataTypes, Model, ModelStatic, Sequelize } from 'sequelize';

export type DemoSandboxSlotRecordStatus =
  | 'available'
  | 'leased'
  | 'draining'
  | 'resetting'
  | 'quarantined';

export interface DemoSandboxSlotRecordAttributes {
  id: string;
  status: DemoSandboxSlotRecordStatus;
  generation: number;
  leaseId: string | null;
  allocatedAt: Date | null;
  lastActivityAt: Date | null;
  idleExpiresAt: Date | null;
  absoluteExpiresAt: Date | null;
  lastResetVerifiedAt: Date | null;
  resetAttemptId: string | null;
  quarantineReason: string | null;
}

export interface DemoSandboxSlotRecord
  extends
    Model<DemoSandboxSlotRecordAttributes, Partial<DemoSandboxSlotRecordAttributes>>,
    DemoSandboxSlotRecordAttributes {}

const statuses: DemoSandboxSlotRecordStatus[] = [
  'available',
  'leased',
  'draining',
  'resetting',
  'quarantined',
];

export function createDemoSandboxSlotModel(sequelize: Sequelize): ModelStatic<DemoSandboxSlotRecord> {
  return sequelize.define<DemoSandboxSlotRecord>(
    'DemoSandboxSlot',
    {
      id: {
        field: 'slot_id',
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      status: {
        type: DataTypes.ENUM(...statuses),
        allowNull: false,
      },
      generation: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      leaseId: {
        field: 'lease_id',
        type: DataTypes.UUID,
        allowNull: true,
      },
      allocatedAt: {
        field: 'allocated_at',
        type: DataTypes.DATE(3),
        allowNull: true,
      },
      lastActivityAt: {
        field: 'last_activity_at',
        type: DataTypes.DATE(3),
        allowNull: true,
      },
      idleExpiresAt: {
        field: 'idle_expires_at',
        type: DataTypes.DATE(3),
        allowNull: true,
      },
      absoluteExpiresAt: {
        field: 'absolute_expires_at',
        type: DataTypes.DATE(3),
        allowNull: true,
      },
      lastResetVerifiedAt: {
        field: 'last_reset_verified_at',
        type: DataTypes.DATE(3),
        allowNull: true,
      },
      resetAttemptId: {
        field: 'reset_attempt_id',
        type: DataTypes.UUID,
        allowNull: true,
      },
      quarantineReason: {
        field: 'quarantine_reason',
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: 'DemoSandboxSlot',
      timestamps: false,
      freezeTableName: true,
    },
  );
}
