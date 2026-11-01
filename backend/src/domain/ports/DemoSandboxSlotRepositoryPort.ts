import { DemoSandboxLeasePolicy, DemoSandboxSlotSnapshot } from '../entities/DemoSandboxSlot';

export interface DemoSandboxSlotRepositoryPort {
  registerConfiguredSlots(slotIds: readonly string[], maxSlots: number): Promise<void>;
  claimAvailableSlot(
    leaseId: string,
    now: Date,
    policy: DemoSandboxLeasePolicy,
  ): Promise<DemoSandboxSlotSnapshot | null>;
  expireDueLeases(now: Date): Promise<DemoSandboxSlotSnapshot[]>;
  beginReset(
    slotId: string,
    leaseId: string,
    resetAttemptId: string,
  ): Promise<DemoSandboxSlotSnapshot | null>;
  beginResetRecovery(
    slotId: string,
    leaseId: string,
    expectedResetAttemptId: string,
    nextResetAttemptId: string,
  ): Promise<DemoSandboxSlotSnapshot | null>;
  completeReset(
    slotId: string,
    leaseId: string,
    resetAttemptId: string,
    verifiedAt: Date,
    verified: boolean,
  ): Promise<'available' | 'quarantined' | 'stale'>;
  quarantine(
    slotId: string,
    leaseId: string,
    resetAttemptId: string,
    reason: string,
  ): Promise<boolean>;
}
