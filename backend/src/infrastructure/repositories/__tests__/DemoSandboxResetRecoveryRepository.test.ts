import { ModelCtor, Sequelize } from 'sequelize';
import { DemoSandboxSlot } from '../../../domain/entities/DemoSandboxSlot';
import { DemoSandboxSlotRecord } from '../../../database/models/DemoSandboxSlot';
import { SequelizeDemoSandboxSlotRepository } from '../SequelizeDemoSandboxSlotRepository';

const now = new Date('2026-10-26T12:00:00.000Z');
type ResettingRecord = ReturnType<DemoSandboxSlot['snapshot']> & {
  resetAttemptId: string | null;
  update: jest.Mock;
};
function makeRepository() {
  const transaction = { LOCK: { UPDATE: 'UPDATE_LOCK' } };
  const sequelize = {
    transaction: jest.fn((callback: (value: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  } as unknown as Sequelize;
  const slot = DemoSandboxSlot.create('slot-a');
  slot.allocate('lease-a', now, { idleTimeoutMs: 20_000, maxLifetimeMs: 60_000 });
  slot.expireIfDue(new Date(now.getTime() + 20_000));
  slot.beginReset('attempt-old');
  const record = {
    ...slot.snapshot(),
    resetAttemptId: 'attempt-old',
    update: jest.fn(),
  } as ResettingRecord;
  record.update.mockImplementation(async (values: Partial<ResettingRecord>) => {
    Object.assign(record, values);
  });
  const findOne = jest.fn(async (options: { where: Record<string, unknown> }) => {
    const expectedAttemptId = options.where.resetAttemptId;
    if (expectedAttemptId !== undefined && expectedAttemptId !== record.resetAttemptId) {
      return null;
    }
    return record as unknown as DemoSandboxSlotRecord;
  });
  const model = {
    findOne,
    findAll: jest.fn(),
    findOrCreate: jest.fn(),
  } as unknown as ModelCtor<DemoSandboxSlotRecord>;
  const repository = new SequelizeDemoSandboxSlotRepository(sequelize, model);
  return { repository, record, findOne, transaction };
}

describe('operator-mediated reset recovery repository fencing', () => {
  it('rotates a resetting attempt once and rejects stale completion after recovery', async () => {
    const { repository, record, findOne, transaction } = makeRepository();

    const recovered = await repository.beginResetRecovery(
      'slot-a',
      'lease-a',
      'attempt-old',
      'attempt-new',
    );
    expect(recovered).toMatchObject({
      id: 'slot-a',
      status: 'resetting',
      leaseId: 'lease-a',
      resetAttemptId: 'attempt-new',
    });
    expect(record.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resetting', resetAttemptId: 'attempt-new' }),
      { transaction },
    );
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'slot-a',
          leaseId: 'lease-a',
          status: 'resetting',
          resetAttemptId: 'attempt-old',
        },
        transaction,
        lock: 'UPDATE_LOCK',
      }),
    );

    const competingRecovery = await repository.beginResetRecovery(
      'slot-a',
      'lease-a',
      'attempt-old',
      'attempt-competing',
    );
    expect(competingRecovery).toBeNull();

    await expect(
      repository.completeReset('slot-a', 'lease-a', 'attempt-old', now, true),
    ).resolves.toBe('stale');
    await expect(
      repository.quarantine('slot-a', 'lease-a', 'attempt-old', 'reset_failed'),
    ).resolves.toBe(false);
    expect(record.update).toHaveBeenCalledTimes(1);
    expect(record.status).toBe('resetting');
    expect(record.resetAttemptId).toBe('attempt-new');

    await expect(
      repository.completeReset('slot-a', 'lease-a', 'attempt-new', now, true),
    ).resolves.toBe('available');
    expect(record.status).toBe('available');
    expect(record.resetAttemptId).toBeNull();
  });
});
