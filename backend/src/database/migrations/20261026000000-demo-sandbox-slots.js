'use strict';

const { DataTypes } = require('sequelize');

const TABLE_NAME = 'DemoSandboxSlot';
const SLOT_STATUSES = ['available', 'leased', 'draining', 'resetting', 'quarantined'];

module.exports = {
  async up({ context }) {
    await context.sequelize.transaction(async (transaction) => {
      await context.createTable(
        TABLE_NAME,
        {
          slot_id: {
            type: DataTypes.STRING(64),
            allowNull: false,
            primaryKey: true,
          },
          status: {
            type: DataTypes.ENUM(...SLOT_STATUSES),
            allowNull: false,
          },
          generation: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
          },
          lease_id: {
            type: DataTypes.UUID,
            allowNull: true,
          },
          allocated_at: {
            type: DataTypes.DATE(3),
            allowNull: true,
          },
          last_activity_at: {
            type: DataTypes.DATE(3),
            allowNull: true,
          },
          idle_expires_at: {
            type: DataTypes.DATE(3),
            allowNull: true,
          },
          absolute_expires_at: {
            type: DataTypes.DATE(3),
            allowNull: true,
          },
          last_reset_verified_at: {
            type: DataTypes.DATE(3),
            allowNull: true,
          },
          reset_attempt_id: {
            type: DataTypes.UUID,
            allowNull: true,
          },
          quarantine_reason: {
            type: DataTypes.STRING(255),
            allowNull: true,
          },
        },
        { transaction },
      );

      await context.addIndex(TABLE_NAME, ['status', 'slot_id'], {
        name: 'idx_demo_sandbox_slot_claim',
        transaction,
      });
      await context.addIndex(TABLE_NAME, ['status', 'idle_expires_at'], {
        name: 'idx_demo_sandbox_slot_expiry',
        transaction,
      });
      await context.addIndex(TABLE_NAME, ['lease_id'], {
        name: 'uq_demo_sandbox_slot_lease_id',
        unique: true,
        transaction,
      });
      await context.addIndex(TABLE_NAME, ['reset_attempt_id'], {
        name: 'uq_demo_sandbox_slot_reset_attempt',
        unique: true,
        transaction,
      });
    });
  },

  async down({ context }) {
    await context.sequelize.transaction(async (transaction) => {
      await context.dropTable(TABLE_NAME, { transaction });
    });
  },
};
