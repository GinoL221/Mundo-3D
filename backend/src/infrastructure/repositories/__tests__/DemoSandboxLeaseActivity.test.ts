import { Sequelize, ModelStatic, Op } from 'sequelize';
import { DemoSandboxSlot } from '../../../domain/entities/DemoSandboxSlot';
import { DemoSandboxSlotRecord } from '../../../database/models/DemoSandboxSlot';
import { SequelizeDemoSandboxSlotRepository } from '../SequelizeDemoSandboxSlotRepository';
import { ValidateDemoSandboxLeaseUseCase } from '../../../application/use-cases/ValidateDemoSandboxLeaseUseCase';

const now = new Date('2026-10-26T12:00:00.000Z');
const policy = { idleTimeoutMs: 20_000, maxLifetimeMs: 60_000 };

function setup() {
  const slot = DemoSandboxSlot.create('slot-a');
  slot.allocate('lease-a', now, policy);
  const record = { ...slot.snapshot(), update: jest.fn().mockResolvedValue(undefined) };
  const transaction = { LOCK: { UPDATE: 'UPDATE_LOCK' } };
  const sequelize = {
    transaction: jest.fn((fn: (tx: typeof transaction) => Promise<unknown>) => fn(transaction)),
  } as unknown as Sequelize;
  const model = {
    findOrCreate: jest.fn().mockResolvedValue([record, true]),
    findOne: jest.fn().mockResolvedValue(record),
  } as unknown as ModelStatic<DemoSandboxSlotRecord>;
  const repository = new SequelizeDemoSandboxSlotRepository(sequelize, model);
  return { record, transaction, model, sequelize, repository };
}

test('renews an active configured lease atomically under a row lock', async () => {
  const { record, transaction, model, repository } = setup();
  await repository.registerConfiguredSlots(['slot-a'], 1);
  const at = new Date(now.getTime() + 10_000);
  const result = await repository.recordLeaseActivity('lease-a', { now: () => at }, policy);
  expect(result).toMatchObject({
    id: 'slot-a',
    status: 'leased',
    lastActivityAt: at,
    idleExpiresAt: new Date(now.getTime() + 30_000),
  });
  expect(model.findOne).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { leaseId: 'lease-a', status: 'leased', id: { [Op.in]: ['slot-a'] } },
      transaction,
      lock: 'UPDATE_LOCK',
    }),
  );
  expect(record.update).toHaveBeenCalledWith(
    expect.objectContaining({
      lastActivityAt: at,
      idleExpiresAt: new Date(now.getTime() + 30_000),
    }),
    { transaction },
  );
});

test.each(['idle', 'absolute'] as const)(
  'expires a due lease and persists draining at the %s boundary',
  async (boundary) => {
    const { record, repository, transaction } = setup();
    const elapsed = boundary === 'idle' ? 20_000 : 60_000;
    if (boundary === 'absolute') record.idleExpiresAt = new Date(now.getTime() + 60_000);
    await repository.registerConfiguredSlots(['slot-a'], 1);
    expect(
      await repository.recordLeaseActivity(
        'lease-a',
        { now: () => new Date(now.getTime() + elapsed) },
        policy,
      ),
    ).toBeNull();
    expect(record.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draining', leaseId: 'lease-a' }),
      { transaction },
    );
  },
);

test('rejects unknown or empty leases without writes', async () => {
  const { repository, model, record } = setup();
  await repository.registerConfiguredSlots(['slot-a'], 1);
  jest.mocked(model.findOne).mockResolvedValue(null);
  expect(await repository.recordLeaseActivity('missing', { now: () => now }, policy)).toBeNull();
  expect(await repository.recordLeaseActivity('', { now: () => now }, policy)).toBeNull();
  expect(record.update).not.toHaveBeenCalled();
});

test('checks expiry using the time after acquiring the row lock', async () => {
  const { repository, model, record, transaction } = setup();
  await repository.registerConfiguredSlots(['slot-a'], 1);
  let locked = false;
  jest.mocked(model.findOne).mockImplementation(async () => {
    locked = true;
    return record as unknown as DemoSandboxSlotRecord;
  });
  const clock = {
    now: jest.fn(() => {
      expect(locked).toBe(true);
      return new Date(now.getTime() + 20_001);
    }),
  };
  const useCase = new ValidateDemoSandboxLeaseUseCase(repository, policy, clock);
  expect(await useCase.execute('lease-a')).toBeNull();
  expect(record.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'draining' }), {
    transaction,
  });
});

test('use case delegates lease validation with the injected clock and policy', async () => {
  const { repository } = setup();
  const activity = jest.spyOn(repository, 'recordLeaseActivity').mockResolvedValue(null);
  const clock = { now: () => now };
  const useCase = new ValidateDemoSandboxLeaseUseCase(repository, policy, clock);
  expect(await useCase.execute('lease-a')).toBeNull();
  expect(activity).toHaveBeenCalledWith('lease-a', clock, policy);
});
