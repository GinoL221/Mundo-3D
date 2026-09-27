'use strict';

const migration = require('../20260927000000-custom-commission-requests');

describe('custom commission request migration', () => {
  function makeContext() {
    const context = {
      createTable: jest.fn().mockResolvedValue(undefined),
      addIndex: jest.fn().mockResolvedValue(undefined),
      addConstraint: jest.fn().mockResolvedValue(undefined),
      dropTable: jest.fn().mockResolvedValue(undefined),
    };
    context.sequelize = { transaction: jest.fn((callback) => callback('transaction')) };
    return context;
  }

  it('creates request storage, expiry index, and nullable product FK with SET NULL', async () => {
    const context = makeContext();
    await migration.up({ context });
    expect(context.createTable).toHaveBeenCalledWith(
      'CustomCommissionRequest',
      expect.objectContaining({
        name: expect.objectContaining({ allowNull: false }),
        email: expect.objectContaining({ allowNull: false }),
        idea: expect.objectContaining({ allowNull: false }),
        id_product: expect.objectContaining({ allowNull: true }),
        expires_at: expect.objectContaining({ allowNull: false }),
      }),
      expect.any(Object),
    );
    expect(context.addIndex).toHaveBeenCalledWith('CustomCommissionRequest', ['expires_at'], expect.objectContaining({ name: 'idx_custom_commission_request_expires_at' }));
    expect(context.addConstraint).toHaveBeenCalledWith('CustomCommissionRequest', expect.objectContaining({ fields: ['id_product'], onDelete: 'SET NULL', type: 'foreign key' }));
  });

  it('drops the table on rollback and attributes DDL failures', async () => {
    const context = makeContext();
    await migration.down({ context });
    expect(context.dropTable).toHaveBeenCalledWith('CustomCommissionRequest', { transaction: 'transaction' });
    context.dropTable.mockRejectedValueOnce(new Error('boom'));
    await expect(migration.down({ context })).rejects.toThrow(/auto-commits per statement/);
  });
});
