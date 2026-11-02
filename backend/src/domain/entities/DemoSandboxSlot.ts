export type DemoSandboxSlotStatus =
  | 'available'
  | 'leased'
  | 'draining'
  | 'resetting'
  | 'quarantined';

export interface DemoSandboxLeasePolicy {
  idleTimeoutMs: number;
  maxLifetimeMs: number;
}

export interface DemoSandboxSlotSnapshot {
  id: string;
  status: DemoSandboxSlotStatus;
  generation: number;
  leaseId: string | null;
  allocatedAt: Date | null;
  lastActivityAt: Date | null;
  idleExpiresAt: Date | null;
  absoluteExpiresAt: Date | null;
  lastResetVerifiedAt: Date | null;
  resetAttemptId: string | null;
  quarantineReason: string | null;
}

const activeStatuses = new Set<DemoSandboxSlotStatus>(['leased', 'draining', 'resetting']);
const statuses = new Set<DemoSandboxSlotStatus>([
  'available',
  'leased',
  'draining',
  'resetting',
  'quarantined',
]);

function cloneDate(value: Date | null): Date | null {
  return value ? new Date(value.getTime()) : null;
}

function assertDate(value: Date): void {
  if (!Number.isFinite(value.getTime())) {
    throw new Error('Demo sandbox timestamps must be valid dates');
  }
}

function assertPolicy(policy: DemoSandboxLeasePolicy): void {
  if (
    !Number.isFinite(policy.idleTimeoutMs) ||
    policy.idleTimeoutMs <= 0 ||
    !Number.isFinite(policy.maxLifetimeMs) ||
    policy.maxLifetimeMs <= 0
  ) {
    throw new Error('Demo sandbox lease durations must be finite positive milliseconds');
  }
}

function expirationFrom(now: Date, durationMs: number): Date {
  const expiration = new Date(now.getTime() + durationMs);
  assertDate(expiration);
  return expiration;
}

function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

export class DemoSandboxSlot {
  private constructor(private state: DemoSandboxSlotSnapshot) {}

  static create(id: string): DemoSandboxSlot {
    if (!id.trim()) {
      throw new Error('Demo sandbox slot id is required');
    }

    return new DemoSandboxSlot({
      id,
      status: 'available',
      generation: 0,
      leaseId: null,
      allocatedAt: null,
      lastActivityAt: null,
      idleExpiresAt: null,
      absoluteExpiresAt: null,
      lastResetVerifiedAt: null,
      resetAttemptId: null,
      quarantineReason: null,
    });
  }

  static restore(snapshot: DemoSandboxSlotSnapshot): DemoSandboxSlot {
    if (!snapshot.id.trim() || !statuses.has(snapshot.status)) {
      throw new Error('Invalid demo sandbox slot snapshot');
    }
    if (!Number.isSafeInteger(snapshot.generation) || snapshot.generation < 0) {
      throw new Error('Invalid demo sandbox slot generation');
    }

    const hasLease = snapshot.leaseId !== null;
    const hasLeaseTimes =
      snapshot.allocatedAt !== null &&
      snapshot.lastActivityAt !== null &&
      snapshot.idleExpiresAt !== null &&
      snapshot.absoluteExpiresAt !== null;
    if (activeStatuses.has(snapshot.status) && (!hasLease || !hasLeaseTimes)) {
      throw new Error('Active demo sandbox slot requires complete lease state');
    }
    if (snapshot.status === 'resetting' && !snapshot.resetAttemptId?.trim()) {
      throw new Error('Resetting demo sandbox slot requires a reset attempt id');
    }
    if (snapshot.status !== 'resetting' && snapshot.resetAttemptId !== null) {
      throw new Error('Only resetting demo sandbox slots may retain a reset attempt id');
    }
    if (snapshot.status === 'available' && (hasLease || hasLeaseTimes)) {
      throw new Error('Available demo sandbox slot cannot retain lease state');
    }

    return new DemoSandboxSlot({
      ...snapshot,
      allocatedAt: cloneDate(snapshot.allocatedAt),
      lastActivityAt: cloneDate(snapshot.lastActivityAt),
      idleExpiresAt: cloneDate(snapshot.idleExpiresAt),
      absoluteExpiresAt: cloneDate(snapshot.absoluteExpiresAt),
      lastResetVerifiedAt: cloneDate(snapshot.lastResetVerifiedAt),
    });
  }

  snapshot(): DemoSandboxSlotSnapshot {
    return {
      ...this.state,
      allocatedAt: cloneDate(this.state.allocatedAt),
      lastActivityAt: cloneDate(this.state.lastActivityAt),
      idleExpiresAt: cloneDate(this.state.idleExpiresAt),
      absoluteExpiresAt: cloneDate(this.state.absoluteExpiresAt),
      lastResetVerifiedAt: cloneDate(this.state.lastResetVerifiedAt),
    };
  }

  allocate(leaseId: string, now: Date, policy: DemoSandboxLeasePolicy): boolean {
    assertDate(now);
    assertPolicy(policy);
    if (!leaseId.trim() || this.state.status !== 'available') {
      return false;
    }

    const absoluteExpiresAt = expirationFrom(now, policy.maxLifetimeMs);
    const idleExpiresAt = minDate(expirationFrom(now, policy.idleTimeoutMs), absoluteExpiresAt);
    this.state = {
      ...this.state,
      status: 'leased',
      leaseId,
      allocatedAt: cloneDate(now),
      lastActivityAt: cloneDate(now),
      idleExpiresAt,
      absoluteExpiresAt,
      quarantineReason: null,
    };
    return true;
  }

  recordActivity(leaseId: string, now: Date, policy: DemoSandboxLeasePolicy): boolean {
    assertDate(now);
    assertPolicy(policy);
    if (this.state.status !== 'leased' || this.state.leaseId !== leaseId) {
      return false;
    }

    const idleExpiresAt = this.state.idleExpiresAt;
    const absoluteExpiresAt = this.state.absoluteExpiresAt;
    if (!idleExpiresAt || !absoluteExpiresAt) {
      throw new Error('Leased demo sandbox slot is missing expiry timestamps');
    }
    if (now.getTime() >= idleExpiresAt.getTime() || now.getTime() >= absoluteExpiresAt.getTime()) {
      this.state = { ...this.state, status: 'draining' };
      return false;
    }

    if (this.state.lastActivityAt && now.getTime() < this.state.lastActivityAt.getTime()) {
      return true;
    }

    this.state = {
      ...this.state,
      lastActivityAt: cloneDate(now),
      idleExpiresAt: minDate(expirationFrom(now, policy.idleTimeoutMs), absoluteExpiresAt),
    };
    return true;
  }

  expireIfDue(now: Date): boolean {
    assertDate(now);
    if (this.state.status !== 'leased') {
      return false;
    }

    const idleExpiresAt = this.state.idleExpiresAt;
    const absoluteExpiresAt = this.state.absoluteExpiresAt;
    if (!idleExpiresAt || !absoluteExpiresAt) {
      throw new Error('Leased demo sandbox slot is missing expiry timestamps');
    }
    if (now.getTime() < idleExpiresAt.getTime() && now.getTime() < absoluteExpiresAt.getTime()) {
      return false;
    }

    this.state = { ...this.state, status: 'draining' };
    return true;
  }

  beginReset(resetAttemptId: string): boolean {
    if (this.state.status !== 'draining' || !resetAttemptId.trim()) {
      return false;
    }
    this.state = { ...this.state, status: 'resetting', resetAttemptId };
    return true;
  }

  beginResetRecovery(expectedAttemptId: string, nextAttemptId: string): boolean {
    if (
      this.state.status !== 'resetting' ||
      !expectedAttemptId.trim() ||
      this.state.resetAttemptId !== expectedAttemptId ||
      !nextAttemptId.trim() ||
      nextAttemptId === expectedAttemptId
    ) {
      return false;
    }
    this.state = { ...this.state, resetAttemptId: nextAttemptId };
    return true;
  }

  completeReset(resetAttemptId: string, verifiedAt: Date, verified: boolean): boolean {
    assertDate(verifiedAt);
    if (this.state.status !== 'resetting' || this.state.resetAttemptId !== resetAttemptId) {
      return false;
    }
    if (!verified) {
      this.state = {
        ...this.clearLeaseState(),
        status: 'quarantined',
        quarantineReason: 'reset_verification_failed',
      };
      return false;
    }

    this.state = {
      ...this.clearLeaseState(),
      status: 'available',
      generation: this.state.generation + 1,
      lastResetVerifiedAt: cloneDate(verifiedAt),
      quarantineReason: null,
    };
    return true;
  }

  quarantine(reason: string, resetAttemptId: string): boolean {
    if (
      this.state.status !== 'resetting' ||
      this.state.resetAttemptId !== resetAttemptId ||
      !resetAttemptId.trim()
    ) {
      return false;
    }
    if (!reason.trim()) {
      throw new Error('Demo sandbox quarantine reason is required');
    }

    this.state = {
      ...this.clearLeaseState(),
      status: 'quarantined',
      quarantineReason: reason,
    };
    return true;
  }

  private clearLeaseState(): DemoSandboxSlotSnapshot {
    return {
      ...this.state,
      leaseId: null,
      allocatedAt: null,
      lastActivityAt: null,
      idleExpiresAt: null,
      absoluteExpiresAt: null,
      resetAttemptId: null,
    };
  }
}
