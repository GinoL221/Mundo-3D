const migration = require('../20261127000000-custom-commission-requests-user-and-phone');

describe('20261127000000-custom-commission-requests-user-and-phone migration', () => {
  const buildContext = () => ({
    sequelize: {
      transaction: jest.fn((callback) => callback('transaction')),
    },
    addColumn: jest.fn().mockResolvedValue(undefined),
    addIndex: jest.fn().mockResolvedValue(undefined),
    addConstraint: jest.fn().mockResolvedValue(undefined),
    removeConstraint: jest.fn().mockResolvedValue(undefined),
    removeIndex: jest.fn().mockResolvedValue(undefined),
    removeColumn: jest.fn().mockResolvedValue(undefined),
  });

  it('adds nullable id_user, optional phone, composite index, and SET NULL FK on up', async () => {
    const context = buildContext();

    await migration.up({ context });

    expect(context.addColumn).toHaveBeenNthCalledWith(
      1,
      'CustomCommissionRequest',
      'id_user',
      expect.objectContaining({ allowNull: true }),
      { transaction: 'transaction' },
    );
    expect(context.addColumn).toHaveBeenNthCalledWith(
      2,
      'CustomCommissionRequest',
      'phone',
      expect.objectContaining({ allowNull: true }),
      { transaction: 'transaction' },
    );
    expect(context.addIndex).toHaveBeenCalledWith(
      'CustomCommissionRequest',
      ['id_user', 'expires_at'],
      expect.objectContaining({ name: 'idx_custom_commission_request_user_expires' }),
    );
    expect(context.addConstraint).toHaveBeenCalledWith(
      'CustomCommissionRequest',
      expect.objectContaining({
        fields: ['id_user'],
        type: 'foreign key',
        name: 'fk_custom_commission_request_user',
        references: { table: 'User', field: 'id_user' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  });

  it('removes FK, index, phone, and id_user in reverse order on down', async () => {
    const context = buildContext();

    await migration.down({ context });

    expect(context.removeConstraint).toHaveBeenCalledWith(
      'CustomCommissionRequest',
      'fk_custom_commission_request_user',
      { transaction: 'transaction' },
    );
    expect(context.removeIndex).toHaveBeenCalledWith(
      'CustomCommissionRequest',
      'idx_custom_commission_request_user_expires',
      { transaction: 'transaction' },
    );
    expect(context.removeColumn).toHaveBeenNthCalledWith(1, 'CustomCommissionRequest', 'phone', {
      transaction: 'transaction',
    });
    expect(context.removeColumn).toHaveBeenNthCalledWith(2, 'CustomCommissionRequest', 'id_user', {
      transaction: 'transaction',
    });
  });
});
