import type { TransactionContext, UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';
import type { DemoSandboxSlotRepositoryPort } from '../../domain/ports/DemoSandboxSlotRepositoryPort';
import type { DemoSandboxClockPort } from '../../domain/ports/DemoSandboxRuntimePorts';
import type {
  SandboxResetIdentity,
  SandboxResetReceiptConsumerPort,
} from '../../domain/ports/SandboxResetReceiptConsumerPort';
import { ReleaseFencedSandboxSlot } from '../use-cases/ReleaseFencedSandboxSlot';

const tx = {} as TransactionContext;
const now = new Date('2026-11-03T10:00:00.000Z');
const identity: SandboxResetIdentity = {
  slotId: 'slot-a',
  generation: 2,
  attemptId: 'attempt-123',
  seedVersion: 'seed-v1',
};

function setup() {
  const slotUow: UnitOfWorkPort = {
    runInTransaction: jest.fn(async (work) => work(tx)),
  };
  const receiptConsumer: SandboxResetReceiptConsumerPort = {
    consume: jest.fn().mockResolvedValue(true),
  };
  const slotRepository: DemoSandboxSlotRepositoryPort = {
    registerConfiguredSlots: jest.fn(),
    claimAvailableSlot: jest.fn(),
    recordLeaseActivity: jest.fn(),
    expireDueLeases: jest.fn(),
    beginReset: jest.fn(),
    beginResetRecovery: jest.fn(),
    completeReset: jest.fn().mockResolvedValue('available'),
    quarantine: jest.fn().mockResolvedValue(true),
  };
  const clock: DemoSandboxClockPort = { now: () => now };
  const coordinator = new ReleaseFencedSandboxSlot(slotUow, receiptConsumer, slotRepository, clock);
  return { coordinator, slotUow, receiptConsumer, slotRepository };
}

describe('ReleaseFencedSandboxSlot', () => {
  it('releases the slot to available after receipt is successfully consumed', async () => {
    const { coordinator, receiptConsumer, slotRepository, slotUow } = setup();

    const result = await coordinator.execute(identity, 'lease-xyz');

    expect(result).toBe('available');
    expect(slotUow.runInTransaction).toHaveBeenCalledTimes(1);
    expect(receiptConsumer.consume).toHaveBeenCalledWith(identity, tx);
    expect(slotRepository.completeReset).toHaveBeenCalledWith(
      'slot-a',
      'lease-xyz',
      'attempt-123',
      now,
      true,
    );
    expect(slotRepository.quarantine).not.toHaveBeenCalled();
  });

  it('quarantines the slot if receipt consumption returns false', async () => {
    const { coordinator, receiptConsumer, slotRepository } = setup();
    (receiptConsumer.consume as jest.Mock).mockResolvedValue(false);

    const result = await coordinator.execute(identity, 'lease-xyz');

    expect(result).toBe('quarantined');
    expect(slotRepository.completeReset).not.toHaveBeenCalled();
    expect(slotRepository.quarantine).toHaveBeenCalledWith(
      'slot-a',
      'lease-xyz',
      'attempt-123',
      'unverified_receipt',
    );
  });

  it('reports uncertainty without control-plane changes if receipt consumer throws', async () => {
    const { coordinator, receiptConsumer, slotRepository } = setup();
    (receiptConsumer.consume as jest.Mock).mockRejectedValue(new Error('DB failure'));

    const result = await coordinator.execute(identity, 'lease-xyz');

    expect(result).toBe('uncertain');
    expect(slotRepository.completeReset).not.toHaveBeenCalled();
    expect(slotRepository.quarantine).not.toHaveBeenCalled();
  });

  it('reports uncertainty without control-plane changes if slot unit of work rejects', async () => {
    const { coordinator, slotUow, slotRepository } = setup();
    (slotUow.runInTransaction as jest.Mock).mockRejectedValue(new Error('Connection lost'));

    const result = await coordinator.execute(identity, 'lease-xyz');

    expect(result).toBe('uncertain');
    expect(slotRepository.completeReset).not.toHaveBeenCalled();
    expect(slotRepository.quarantine).not.toHaveBeenCalled();
  });

  it('reports stale when quarantine is not confirmed', async () => {
    const { coordinator, receiptConsumer, slotRepository } = setup();
    jest.mocked(receiptConsumer.consume).mockResolvedValue(false);
    jest.mocked(slotRepository.quarantine).mockResolvedValue(false);
    await expect(coordinator.execute(identity, 'lease-xyz')).resolves.toBe('stale');
    expect(slotRepository.completeReset).not.toHaveBeenCalled();
  });

  it('reports uncertainty on quarantine failure without attempting release', async () => {
    const { coordinator, receiptConsumer, slotRepository } = setup();
    jest.mocked(receiptConsumer.consume).mockResolvedValue(false);
    jest.mocked(slotRepository.quarantine).mockRejectedValue(new Error('ack lost'));
    await expect(coordinator.execute(identity, 'lease-xyz')).resolves.toBe('uncertain');
    expect(slotRepository.completeReset).not.toHaveBeenCalled();
  });

  it('reports uncertainty on control-plane failure without guessing or retrying', async () => {
    const { coordinator, slotRepository } = setup();
    jest.mocked(slotRepository.completeReset).mockRejectedValue(new Error('ack lost'));
    await expect(coordinator.execute(identity, 'lease-xyz')).resolves.toBe('uncertain');
    expect(slotRepository.completeReset).toHaveBeenCalledTimes(1);
    expect(slotRepository.quarantine).not.toHaveBeenCalled();
  });
});
