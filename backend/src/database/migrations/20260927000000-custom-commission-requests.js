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
        `Custom-commission-request migration ${direction} failed while "${name}" ` +
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
            name: 'create request table',
            run: () =>
              queryInterface.createTable(
                TABLE,
                {
                  id_custom_commission_request: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    autoIncrement: true,
                    primaryKey: true,
                  },
                  name: { type: DataTypes.STRING(255), allowNull: false },
                  email: { type: DataTypes.STRING(320), allowNull: false },
                  idea: { type: DataTypes.TEXT, allowNull: false },
                  id_product: { type: DataTypes.INTEGER, allowNull: true },
                  created_at: { type: DataTypes.DATE, allowNull: false },
                  expires_at: { type: DataTypes.DATE, allowNull: false },
                },
                { transaction, engine: 'InnoDB', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
              ),
          },
          {
            name: 'index request expiry',
            run: () =>
              queryInterface.addIndex(TABLE, ['expires_at'], {
                name: 'idx_custom_commission_request_expires_at',
                transaction,
              }),
          },
          {
            name: 'add optional product reference',
            run: () =>
              queryInterface.addConstraint(TABLE, {
                fields: ['id_product'],
                type: 'foreign key',
                name: 'fk_custom_commission_request_product',
                references: { table: 'Product', field: 'id_product' },
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
      runSteps([{ name: 'drop request table', run: () => queryInterface.dropTable(TABLE, { transaction }) }], 'down'),
    );
  },
};
