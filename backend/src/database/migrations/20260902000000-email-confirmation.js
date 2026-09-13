'use strict';

const { DataTypes } = require('sequelize');

// MySQL DDL auto-commits each statement. The transaction scope is conventional
// only; errors identify completed statements for manual operator recovery.
const TOKEN_TABLE = 'EmailConfirmationToken';

async function runSteps(steps, direction) {
  const applied = [];
  for (const { name, run } of steps) {
    try {
      await run();
      applied.push(name);
    } catch (error) {
      error.message =
        `Email-confirmation migration ${direction} failed while "${name}" ` +
        `(already applied: [${applied.join(', ') || 'none'}]). MySQL DDL auto-commits per statement, ` +
        `so completed steps were not rolled back. Original error: ${error.message}`;
      throw error;
    }
  }
}

const tokenColumns = {
  id_email_confirmation_token: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
  },
  id_user: { type: DataTypes.INTEGER, allowNull: false },
  token_hash: { type: DataTypes.CHAR(64), allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  consumed_at: { type: DataTypes.DATE, allowNull: true },
  invalidated_at: { type: DataTypes.DATE, allowNull: true },
  active_slot: { type: DataTypes.TINYINT, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false },
};

module.exports = {
  async up({ context: queryInterface }) {
    const migrationTimestamp = new Date();
    await queryInterface.sequelize.transaction((transaction) =>
      runSteps(
        [
          {
            name: 'add email verification column',
            run: () =>
              queryInterface.addColumn(
                'User',
                'email_verified_at',
                { type: DataTypes.DATE, allowNull: true, defaultValue: null },
                { transaction },
              ),
          },
          {
            name: 'backfill existing users',
            run: () =>
              queryInterface.bulkUpdate(
                'User',
                { email_verified_at: migrationTimestamp },
                { email_verified_at: null },
                { transaction },
              ),
          },
          {
            name: 'create confirmation token table',
            run: () =>
              queryInterface.createTable(TOKEN_TABLE, tokenColumns, {
                transaction,
                engine: 'InnoDB',
                charset: 'utf8mb4',
                collate: 'utf8mb4_unicode_ci',
              }),
          },
          {
            name: 'add token hash index',
            run: () =>
              queryInterface.addIndex(TOKEN_TABLE, ['token_hash'], {
                name: 'uq_email_confirmation_token_hash',
                unique: true,
                transaction,
              }),
          },
          {
            name: 'add active token authority',
            run: () =>
              queryInterface.addIndex(TOKEN_TABLE, ['id_user', 'active_slot'], {
                name: 'uq_email_confirmation_token_user_active_slot',
                unique: true,
                transaction,
              }),
          },
          {
            name: 'add token user history index',
            run: () =>
              queryInterface.addIndex(TOKEN_TABLE, ['id_user', 'created_at'], {
                name: 'idx_email_confirmation_token_user_created',
                transaction,
              }),
          },
          {
            name: 'add token user foreign key',
            run: () =>
              queryInterface.addConstraint(TOKEN_TABLE, {
                fields: ['id_user'],
                type: 'foreign key',
                name: 'fk_email_confirmation_token_user',
                references: { table: 'User', field: 'id_user' },
                onDelete: 'CASCADE',
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
            name: 'drop confirmation token table',
            run: () => queryInterface.dropTable(TOKEN_TABLE, { transaction }),
          },
          {
            name: 'drop email verification column',
            run: () => queryInterface.removeColumn('User', 'email_verified_at', { transaction }),
          },
        ],
        'down',
      ),
    );
  },
};
