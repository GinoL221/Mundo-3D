'use strict';

const migration = require('../20260902000000-email-confirmation');

function queryInterface() {
  const context = {
    addColumn: jest.fn().mockResolvedValue(undefined),
    bulkUpdate: jest.fn().mockResolvedValue(undefined),
    createTable: jest.fn().mockResolvedValue(undefined),
    addIndex: jest.fn().mockResolvedValue(undefined),
    addConstraint: jest.fn().mockResolvedValue(undefined),
    dropTable: jest.fn().mockResolvedValue(undefined),
    removeColumn: jest.fn().mockResolvedValue(undefined),
  };
  context.sequelize = { transaction: jest.fn((callback) => callback('tx-token')) };
  return context;
}

describe('email confirmation migration', () => {
  it('adds the nullable verification field, backfills it, and creates digest-only token storage', async () => {
    const context = queryInterface();

    await migration.up({ context });

    expect(context.addColumn).toHaveBeenCalledWith(
      'User',
      'email_verified_at',
      expect.objectContaining({ allowNull: true, defaultValue: null }),
      { transaction: 'tx-token' },
    );
    expect(context.bulkUpdate).toHaveBeenCalledWith(
      'User',
      expect.objectContaining({ email_verified_at: expect.any(Date) }),
      { email_verified_at: null },
      { transaction: 'tx-token' },
    );
    expect(context.createTable).toHaveBeenCalledWith(
      'EmailConfirmationToken',
      expect.objectContaining({
        token_hash: expect.objectContaining({ allowNull: false }),
        active_slot: expect.objectContaining({ allowNull: true }),
      }),
      expect.objectContaining({ transaction: 'tx-token' }),
    );
    expect(context.addIndex).toHaveBeenCalledWith(
      'EmailConfirmationToken',
      ['id_user', 'active_slot'],
      expect.objectContaining({
        name: 'uq_email_confirmation_token_user_active_slot',
        unique: true,
      }),
    );
    expect(context.addConstraint).toHaveBeenCalledWith(
      'EmailConfirmationToken',
      expect.objectContaining({ onDelete: 'CASCADE', type: 'foreign key' }),
    );
    expect(context.createTable.mock.calls[0][1]).not.toHaveProperty('plaintext');
  });

  it('drops the token table before the user column and attributes MySQL DDL failures', async () => {
    const context = queryInterface();

    await migration.down({ context });

    expect(context.dropTable).toHaveBeenCalledWith('EmailConfirmationToken', {
      transaction: 'tx-token',
    });
    expect(context.removeColumn).toHaveBeenCalledWith('User', 'email_verified_at', {
      transaction: 'tx-token',
    });

    context.dropTable.mockRejectedValueOnce(new Error('boom'));
    await expect(migration.down({ context })).rejects.toThrow(/auto-commits per statement/);
  });
});
