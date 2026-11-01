import { ModelCtor, Op, Sequelize } from 'sequelize';
import {
  DemoSandboxLeasePolicy,
  DemoSandboxSlot,
  DemoSandboxSlotSnapshot,
} from '../../../domain/entities/DemoSandboxSlot';
import { DemoSandboxSlotRecord } from '../../../database/models/DemoSandboxSlot';
import { SequelizeDemoSandboxSlotRepository } from '../SequelizeDemoSandboxSlotRepository';

const policy: DemoSandboxLeasePolicy = { idleTimeoutMs: 20_000, maxLifetimeMs: 60_000 };
const now = new Date('2026-10-26T12:00:00.000Z');

function availableRecord(id: string) {
  return {
    ...DemoSandboxSlot.create(id).snapshot(),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

function makeRepository(modelOverrides: Record<string, unknown> = {}) {
  const transaction = { LOCK: { UPDATE: 'UPDATE_LOCK' } };
  const sequelize = {
    transaction: jest.fn((callback: (value: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  } as unknown as Sequelize;
  const model = {
    findOrCreate: jest.fn().mockResolvedValue([availableRecord('slot-a'), true]),
    findOne: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    ...modelOverrides,
  } as unknown as ModelCtor<DemoSandboxSlotRecord>;
  return {
    repository: new SequelizeDemoSandboxSlotRepository(sequelize, model),
    model,
    sequelize,
    transaction,
  };
}

describe('SequelizeDemoSandboxSlotRepository', () => {
  it('claims and updates one configured slot under a row-locking transaction', async () => {
    const record = availableRecord('slot-a');
    record.update.mockImplementation(async (values: Partial<DemoSandboxSlotSnapshot>) => {
      Object.assign(record, values);
    });
    const { repository, model, transaction } = makeRepository({
      findOne: jest.fn().mockResolvedValue(record),
    });
    await repository.registerConfiguredSlots(['slot-a'], 1);

    const result = await repository.claimAvailableSlot('lease-a', now, policy);

    expect(result).toMatchObject({
      id: 'slot-a',
      status: 'leased',
      generation: 0,
      leaseId: 'lease-a',
      allocatedAt: now,
    });
    expect(model.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'available', id: { [Op.in]: ['slot-a'] } },
        transaction,
        lock: 'UPDATE_LOCK',
      }),
    );
    expect(record.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'leased', leaseId: 'lease-a' }),
      { transaction },
    );
  });

  it('moves only due leases to draining under a row lock', async () => {
    const slot = DemoSandboxSlot.create('slot-a');
    slot.allocate('lease-a', now, policy);
    const record = {
      ...slot.snapshot(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const { repository, model, transaction } = makeRepository({
      findAll: jest.fn().mockResolvedValue([record]),
    });

    const result = await repository.expireDueLeases(new Date(now.getTime() + 20_000));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: 'draining', leaseId: 'lease-a' });
    expect(model.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'leased',
          [Op.or]: [
            { idleExpiresAt: { [Op.lte]: new Date(now.getTime() + 20_000) } },
            { absoluteExpiresAt: { [Op.lte]: new Date(now.getTime() + 20_000) } },
          ],
        },
        transaction,
        lock: 'UPDATE_LOCK',
      }),
    );
    expect(record.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'draining' }), {
      transaction,
    });
  });

  it('persists reset-verification failure as quarantine and clears the old lease', async () => {
    const slot = DemoSandboxSlot.create('slot-a');
    slot.allocate('lease-a', now, policy);
    slot.expireIfDue(new Date(now.getTime() + 20_000));
    slot.beginReset('reset-attempt-a');
    const record = {
      ...slot.snapshot(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const { repository, model, transaction } = makeRepository({
      findOne: jest.fn().mockResolvedValue(record),
    });

    await expect(
      repository.completeReset(
        'slot-a',
        'lease-a',
        'reset-attempt-a',
        new Date(now.getTime() + 21_000),
        false,
      ),
    ).resolves.toBe('quarantined');
    expect(model.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'slot-a',
          leaseId: 'lease-a',
          status: 'resetting',
          resetAttemptId: 'reset-attempt-a',
        },
        transaction,
        lock: 'UPDATE_LOCK',
      }),
    );
    expect(record.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'quarantined',
        leaseId: null,
        resetAttemptId: null,
      }),
      { transaction },
    );
  });

  it('fails closed when the configured pool is empty, even if stale rows exist in storage', async () => {
    const staleRow = availableRecord('stale-slot');
    const { repository, model } = makeRepository({
      findOne: jest.fn().mockResolvedValue(staleRow),
    });
    await repository.registerConfiguredSlots([], 0);

    await expect(repository.claimAvailableSlot('lease-a', now, policy)).resolves.toBeNull();
    expect(model.findOne).not.toHaveBeenCalled();
    expect(staleRow.update).not.toHaveBeenCalled();
  });

  it('filters persisted slot selection to the configured bounded pool', async () => {
    const { repository, model, transaction } = makeRepository({
      findOne: jest.fn().mockResolvedValue(null),
    });
    await repository.registerConfiguredSlots(['slot-a'], 1);

    await expect(repository.claimAvailableSlot('lease-a', now, policy)).resolves.toBeNull();
    expect(model.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'available', id: { [Op.in]: ['slot-a'] } },
        transaction,
        lock: 'UPDATE_LOCK',
      }),
    );
  });

  it('rejects a configuration over its cap before opening a transaction or writing slots', async () => {
    const { repository, sequelize, model } = makeRepository();

    await expect(repository.registerConfiguredSlots(['slot-a', 'slot-b'], 1)).rejects.toThrow(
      'Configured demo sandbox slots exceed the maximum slot count',
    );
    expect(sequelize.transaction).not.toHaveBeenCalled();
    expect(model.findOrCreate).not.toHaveBeenCalled();
  });
});
