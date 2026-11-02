import { DemoSandboxSlot } from './DemoSandboxSlot';

const MINUTE = 60_000;
const policy = { idleTimeoutMs: 20 * MINUTE, maxLifetimeMs: 60 * MINUTE };
const origin = new Date('2026-10-26T12:00:00.000Z');
const at = (minutes: number) => new Date(origin.getTime() + minutes * MINUTE);

describe('DemoSandboxSlot', () => {
  it('allocates only an available slot and bounds the lease by idle and absolute deadlines', () => {
    const slot = DemoSandboxSlot.create('slot-a');

    expect(slot.allocate('lease-a', origin, policy)).toBe(true);
    expect(slot.snapshot()).toMatchObject({
      id: 'slot-a',
      status: 'leased',
      generation: 0,
      leaseId: 'lease-a',
      allocatedAt: origin,
      lastActivityAt: origin,
      idleExpiresAt: at(20),
      absoluteExpiresAt: at(60),
    });
    const allocatedSnapshot = slot.snapshot();

    expect(slot.allocate('lease-b', origin, policy)).toBe(false);
    expect(slot.snapshot()).toEqual(allocatedSnapshot);
  });

  it('extends the idle deadline on activity but never extends the absolute deadline', () => {
    const slot = DemoSandboxSlot.create('slot-a');
    slot.allocate('lease-a', origin, policy);

    expect(slot.recordActivity('lease-a', at(15), policy)).toBe(true);
    expect(slot.snapshot().idleExpiresAt).toEqual(at(35));
    expect(slot.recordActivity('lease-a', at(34), policy)).toBe(true);
    expect(slot.snapshot().idleExpiresAt).toEqual(at(54));
    expect(slot.recordActivity('lease-a', at(53), policy)).toBe(true);
    expect(slot.snapshot()).toMatchObject({
      lastActivityAt: at(53),
      idleExpiresAt: at(60),
      absoluteExpiresAt: at(60),
    });
  });

  it('does not move activity or idle expiry backwards when activity arrives out of order', () => {
    const slot = DemoSandboxSlot.create('slot-a');
    slot.allocate('lease-a', origin, policy);
    expect(slot.recordActivity('lease-a', at(15), policy)).toBe(true);
    const snapshot = slot.snapshot();

    expect(slot.recordActivity('lease-a', at(5), policy)).toBe(true);
    expect(slot.snapshot()).toEqual(snapshot);
  });

  it('fences activity at expiry and drains the slot instead of making it reusable', () => {
    const slot = DemoSandboxSlot.create('slot-a');
    slot.allocate('lease-a', origin, policy);

    expect(slot.expireIfDue(at(20))).toBe(true);
    expect(slot.recordActivity('lease-a', at(20), policy)).toBe(false);
    expect(slot.snapshot()).toMatchObject({ status: 'draining', leaseId: 'lease-a' });
  });

  it('makes a slot available only after reset verification and advances its generation', () => {
    const slot = DemoSandboxSlot.create('slot-a');
    slot.allocate('lease-a', origin, policy);

    expect(slot.beginReset('attempt-a')).toBe(false);
    expect(slot.expireIfDue(at(20))).toBe(true);
    expect(slot.beginReset('attempt-a')).toBe(true);
    expect(slot.completeReset('attempt-a', at(21), true)).toBe(true);
    expect(slot.snapshot()).toMatchObject({
      status: 'available',
      generation: 1,
      leaseId: null,
      allocatedAt: null,
      lastActivityAt: null,
      idleExpiresAt: null,
      absoluteExpiresAt: null,
      lastResetVerifiedAt: at(21),
    });

    expect(slot.allocate('lease-b', at(22), policy)).toBe(true);
    expect(slot.snapshot()).toMatchObject({ generation: 1, leaseId: 'lease-b' });
  });

  it('quarantines a slot when reset verification fails', () => {
    const slot = DemoSandboxSlot.create('slot-a');
    slot.allocate('lease-a', origin, policy);
    slot.expireIfDue(at(20));
    slot.beginReset('attempt-a');

    expect(slot.completeReset('attempt-a', at(21), false)).toBe(false);
    expect(slot.snapshot()).toMatchObject({
      status: 'quarantined',
      generation: 0,
      leaseId: null,
      resetAttemptId: null,
    });
    expect(slot.allocate('lease-b', at(22), policy)).toBe(false);
  });

  it('fences an interrupted reset attempt before operator-mediated recovery', () => {
    const slot = DemoSandboxSlot.create('slot-a');
    slot.allocate('lease-a', origin, policy);
    slot.expireIfDue(at(20));
    expect(slot.beginReset('attempt-old')).toBe(true);

    expect(slot.beginResetRecovery('stale-attempt', 'attempt-new')).toBe(false);
    expect(slot.beginResetRecovery('attempt-old', 'attempt-new')).toBe(true);
    expect(slot.snapshot()).toMatchObject({ status: 'resetting', resetAttemptId: 'attempt-new' });
    expect(slot.completeReset('attempt-old', at(21), true)).toBe(false);
    expect(slot.quarantine('reset_failed', 'attempt-old')).toBe(false);
    expect(slot.snapshot()).toMatchObject({ status: 'resetting', resetAttemptId: 'attempt-new' });

    expect(slot.completeReset('attempt-new', at(22), true)).toBe(true);
    expect(slot.snapshot()).toMatchObject({ status: 'available', resetAttemptId: null });
  });
});
