'use strict';

const migration = require('../20261026000000-demo-sandbox-slots');

function makeContext() {
  const context = {
    createTable: jest.fn().mockResolvedValue(undefined),
    addIndex: jest.fn().mockResolvedValue(undefined),
    dropTable: jest.fn().mockResolvedValue(undefined),
  };
  context.sequelize = { transaction: jest.fn((callback) => callback('transaction')) };
  return context;
}

describe('demo sandbox slot migration', () => {
  it('creates only control-plane lease metadata and indexes bounded-pool claims and expiry scans', async () => {
    const context = makeContext();

    await migration.up({ context });

    const [tableName, columns, options] = context.createTable.mock.calls[0];
    expect(tableName).toBe('DemoSandboxSlot');
    expect(Object.keys(columns).sort()).toEqual(
      [
        'absolute_expires_at',
        'allocated_at',
        'generation',
        'idle_expires_at',
        'last_activity_at',
        'last_reset_verified_at',
        'lease_id',
        'quarantine_reason',
        'reset_attempt_id',
        'slot_id',
        'status',
      ].sort(),
    );
    expect(columns.slot_id).toEqual(
      expect.objectContaining({ allowNull: false, primaryKey: true }),
    );
    expect(columns.status).toEqual(expect.objectContaining({ allowNull: false }));
    expect(columns.generation).toEqual(expect.objectContaining({ allowNull: false }));
    expect(columns.lease_id).toEqual(expect.objectContaining({ allowNull: true }));
    expect(options).toEqual({ transaction: 'transaction' });
    expect(context.addIndex).toHaveBeenCalledWith(
      'DemoSandboxSlot',
      ['status', 'slot_id'],
      expect.objectContaining({ name: 'idx_demo_sandbox_slot_claim' }),
    );
    expect(context.addIndex).toHaveBeenCalledWith(
      'DemoSandboxSlot',
      ['status', 'idle_expires_at'],
      expect.objectContaining({ name: 'idx_demo_sandbox_slot_expiry' }),
    );
    expect(context.addIndex).toHaveBeenCalledWith(
      'DemoSandboxSlot',
      ['reset_attempt_id'],
      expect.objectContaining({ name: 'uq_demo_sandbox_slot_reset_attempt', unique: true }),
    );
  });

  it('drops the control-plane table inside a rollback transaction', async () => {
    const context = makeContext();

    await migration.down({ context });

    expect(context.dropTable).toHaveBeenCalledWith('DemoSandboxSlot', {
      transaction: 'transaction',
    });
  });
});
