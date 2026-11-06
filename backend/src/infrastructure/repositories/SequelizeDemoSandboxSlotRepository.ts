import { Op, Sequelize, Transaction } from 'sequelize';
import {
  DemoSandboxLeasePolicy,
  DemoSandboxSlot,
  DemoSandboxSlotSnapshot,
} from '../../domain/entities/DemoSandboxSlot';
import { DemoSandboxSlotRepositoryPort } from '../../domain/ports/DemoSandboxSlotRepositoryPort';
import { DemoSandboxClockPort } from '../../domain/ports/DemoSandboxRuntimePorts';
import {
  createDemoSandboxSlotModel,
  DemoSandboxSlotRecord,
} from '../../database/models/DemoSandboxSlot';

export class SequelizeDemoSandboxSlotRepository implements DemoSandboxSlotRepositoryPort {
  private readonly model: ReturnType<typeof createDemoSandboxSlotModel>;
  private configuredSlotIds: readonly string[] = [];

  constructor(
    private readonly sequelize: Sequelize,
    model = createDemoSandboxSlotModel(sequelize),
  ) {
    this.model = model;
  }

  async registerConfiguredSlots(slotIds: readonly string[], maxSlots: number): Promise<void> {
    if (!Number.isSafeInteger(maxSlots) || maxSlots < 0) {
      throw new Error('Demo sandbox maximum slot count must be a non-negative integer');
    }
    if (slotIds.length > maxSlots) {
      throw new Error('Configured demo sandbox slots exceed the maximum slot count');
    }
    if (slotIds.some((id) => !id.trim()) || new Set(slotIds).size !== slotIds.length) {
      throw new Error('Configured demo sandbox slot ids must be non-empty and unique');
    }
    if (slotIds.length === 0) {
      this.configuredSlotIds = [];
      return;
    }

    await this.sequelize.transaction(async (transaction) => {
      for (const id of slotIds) {
        await this.model.findOrCreate({
          where: { id },
          defaults: DemoSandboxSlot.create(id).snapshot(),
          transaction,
        });
      }
    });
    this.configuredSlotIds = [...slotIds];
  }

  async claimAvailableSlot(
    leaseId: string,
    now: Date,
    policy: DemoSandboxLeasePolicy,
  ): Promise<DemoSandboxSlotSnapshot | null> {
    if (this.configuredSlotIds.length === 0) {
      return null;
    }

    return this.sequelize.transaction(async (transaction) => {
      const record = await this.model.findOne({
        where: { status: 'available', id: { [Op.in]: this.configuredSlotIds } },
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) {
        return null;
      }

      const slot = DemoSandboxSlot.restore(this.toSnapshot(record));
      if (!slot.allocate(leaseId, now, policy)) {
        return null;
      }

      const snapshot = slot.snapshot();
      await this.persist(record, snapshot, transaction);
      return snapshot;
    });
  }

  async recordLeaseActivity(
    leaseId: string,
    clock: DemoSandboxClockPort,
    policy: DemoSandboxLeasePolicy,
  ): Promise<DemoSandboxSlotSnapshot | null> {
    if (!leaseId.trim() || this.configuredSlotIds.length === 0) return null;
    return this.sequelize.transaction(async (transaction) => {
      const record = await this.model.findOne({
        where: { leaseId, status: 'leased', id: { [Op.in]: this.configuredSlotIds } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) return null;
      const slot = DemoSandboxSlot.restore(this.toSnapshot(record));
      const active = slot.recordActivity(leaseId, clock.now(), policy);
      const snapshot = slot.snapshot();
      if (active || snapshot.status === 'draining') {
        await this.persist(record, snapshot, transaction);
      }
      return active ? snapshot : null;
    });
  }

  async expireDueLeases(now: Date): Promise<DemoSandboxSlotSnapshot[]> {
    return this.sequelize.transaction(async (transaction) => {
      const records = await this.model.findAll({
        where: {
          status: 'leased',
          [Op.or]: [{ idleExpiresAt: { [Op.lte]: now } }, { absoluteExpiresAt: { [Op.lte]: now } }],
        },
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const expired: DemoSandboxSlotSnapshot[] = [];
      for (const record of records) {
        const slot = DemoSandboxSlot.restore(this.toSnapshot(record));
        if (!slot.expireIfDue(now)) {
          continue;
        }
        const snapshot = slot.snapshot();
        await this.persist(record, snapshot, transaction);
        expired.push(snapshot);
      }
      return expired;
    });
  }

  async beginReset(
    slotId: string,
    leaseId: string,
    resetAttemptId: string,
  ): Promise<DemoSandboxSlotSnapshot | null> {
    return this.sequelize.transaction(async (transaction) => {
      const record = await this.model.findOne({
        where: { id: slotId, leaseId, status: 'draining' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) {
        return null;
      }

      const slot = DemoSandboxSlot.restore(this.toSnapshot(record));
      if (!slot.beginReset(resetAttemptId)) {
        return null;
      }
      const snapshot = slot.snapshot();
      await this.persist(record, snapshot, transaction);
      return snapshot;
    });
  }

  async beginResetRecovery(
    slotId: string,
    leaseId: string,
    expectedResetAttemptId: string,
    nextResetAttemptId: string,
  ): Promise<DemoSandboxSlotSnapshot | null> {
    return this.sequelize.transaction(async (transaction) => {
      const record = await this.model.findOne({
        where: {
          id: slotId,
          leaseId,
          status: 'resetting',
          resetAttemptId: expectedResetAttemptId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) {
        return null;
      }

      const slot = DemoSandboxSlot.restore(this.toSnapshot(record));
      if (!slot.beginResetRecovery(expectedResetAttemptId, nextResetAttemptId)) {
        return null;
      }
      const snapshot = slot.snapshot();
      await this.persist(record, snapshot, transaction);
      return snapshot;
    });
  }

  async completeReset(
    slotId: string,
    leaseId: string,
    resetAttemptId: string,
    verifiedAt: Date,
    verified: boolean,
  ): Promise<'available' | 'quarantined' | 'stale'> {
    return this.sequelize.transaction(async (transaction) => {
      const record = await this.model.findOne({
        where: { id: slotId, leaseId, status: 'resetting', resetAttemptId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) {
        return 'stale';
      }

      const slot = DemoSandboxSlot.restore(this.toSnapshot(record));
      const released = slot.completeReset(resetAttemptId, verifiedAt, verified);
      const snapshot = slot.snapshot();
      await this.persist(record, snapshot, transaction);
      return released ? 'available' : 'quarantined';
    });
  }

  async quarantine(
    slotId: string,
    leaseId: string,
    resetAttemptId: string,
    reason: string,
  ): Promise<boolean> {
    return this.sequelize.transaction(async (transaction) => {
      const record = await this.model.findOne({
        where: { id: slotId, leaseId, status: 'resetting', resetAttemptId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) {
        return false;
      }

      const slot = DemoSandboxSlot.restore(this.toSnapshot(record));
      if (!slot.quarantine(reason, resetAttemptId)) {
        return false;
      }
      await this.persist(record, slot.snapshot(), transaction);
      return true;
    });
  }

  private toSnapshot(record: DemoSandboxSlotRecord): DemoSandboxSlotSnapshot {
    return {
      id: record.id,
      status: record.status,
      generation: record.generation,
      leaseId: record.leaseId,
      allocatedAt: record.allocatedAt,
      lastActivityAt: record.lastActivityAt,
      idleExpiresAt: record.idleExpiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
      lastResetVerifiedAt: record.lastResetVerifiedAt,
      resetAttemptId: record.resetAttemptId,
      quarantineReason: record.quarantineReason,
    };
  }

  private async persist(
    record: DemoSandboxSlotRecord,
    snapshot: DemoSandboxSlotSnapshot,
    transaction: Transaction,
  ): Promise<void> {
    await record.update(
      {
        status: snapshot.status,
        generation: snapshot.generation,
        leaseId: snapshot.leaseId,
        allocatedAt: snapshot.allocatedAt,
        lastActivityAt: snapshot.lastActivityAt,
        idleExpiresAt: snapshot.idleExpiresAt,
        absoluteExpiresAt: snapshot.absoluteExpiresAt,
        lastResetVerifiedAt: snapshot.lastResetVerifiedAt,
        resetAttemptId: snapshot.resetAttemptId,
        quarantineReason: snapshot.quarantineReason,
      },
      { transaction },
    );
  }
}
