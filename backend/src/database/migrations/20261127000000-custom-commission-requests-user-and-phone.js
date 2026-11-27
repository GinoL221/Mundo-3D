'use strict';

const { DataTypes } = require('sequelize');
const TABLE = 'CustomCommissionRequest';

async function runSteps(steps, direction) {
  const applied = [];
  for (const { name, run } of steps) {
    try {
      await run();
      applied.push(name);
    } catch (error) {
      error.message =
        `Custom-commission-request user/phone migration ${direction} failed while "${name}" ` +
        `(already applied: [${applied.join(', ') || 'none'}]). MySQL DDL auto-commits per statement, ` +
        `so completed steps were not rolled back. Original error: ${error.message}`;
      throw error;
    }
  }
}

module.exports = {
  async up({ context: queryInterface }) {
    await queryInterface.sequelize.transaction((transaction) =>
      runSteps(
        [
          {
            name: 'add nullable id_user column',
            run: () =>
              queryInterface.addColumn(
                TABLE,
                'id_user',
                { type: DataTypes.INTEGER, allowNull: true },
                { transaction },
              ),
          },
          {
            name: 'add optional phone column',
            run: () =>
              queryInterface.addColumn(
                TABLE,
                'phone',
                { type: DataTypes.STRING(30), allowNull: true },
                { transaction },
              ),
          },
          {
            name: 'index user active requests',
            run: () =>
              queryInterface.addIndex(TABLE, ['id_user', 'expires_at'], {
                name: 'idx_custom_commission_request_user_expires',
                transaction,
              }),
          },
          {
            name: 'add optional user reference',
            run: () =>
              queryInterface.addConstraint(TABLE, {
                fields: ['id_user'],
                type: 'foreign key',
                name: 'fk_custom_commission_request_user',
                references: { table: 'User', field: 'id_user' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
                transaction,
              }),
          },
        ],
        'up',
      ),
    );
  },

  async down({ context: queryInterface }) {
    await queryInterface.sequelize.transaction((transaction) =>
      runSteps(
        [
          {
            name: 'remove optional user reference',
            run: () =>
              queryInterface.removeConstraint(TABLE, 'fk_custom_commission_request_user', {
                transaction,
              }),
          },
          {
            name: 'remove user active requests index',
            run: () =>
              queryInterface.removeIndex(TABLE, 'idx_custom_commission_request_user_expires', {
                transaction,
              }),
          },
          {
            name: 'remove optional phone column',
            run: () => queryInterface.removeColumn(TABLE, 'phone', { transaction }),
          },
          {
            name: 'remove nullable id_user column',
            run: () => queryInterface.removeColumn(TABLE, 'id_user', { transaction }),
          },
        ],
        'down',
      ),
    );
  },
};
