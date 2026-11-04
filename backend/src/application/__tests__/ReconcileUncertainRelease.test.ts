import {
  ReconcileUncertainRelease,
  type ReleaseReconciliationOutcome,
} from '../use-cases/ReconcileUncertainRelease';
import type {
  AuthoritativeReleaseState,
  AuthoritativeReleaseStateReaderPort,
  SandboxReleaseIdentity,
} from '../../domain/ports/AuthoritativeReleaseStateReaderPort';

type Control = NonNullable<AuthoritativeReleaseState['control']>;
type Fence = NonNullable<AuthoritativeReleaseState['fence']>;
type Receipt = NonNullable<AuthoritativeReleaseState['receipt']>;
type EvidenceOutcome = 'committed' | 'not_committed';

const identity: SandboxReleaseIdentity = Object.freeze({
  releaseId: 'release-1',
  slotId: 'slot-1',
  leaseId: 'lease-100',
  generation: 5,
  attemptId: 'attempt-500',
  seedVersion: 'v1.0.0',
});

const releasedControl: Control = {
  slotId: 'slot-1',
  status: 'available',
  generation: 6,
  leaseId: null,
  resetAttemptId: null,
};

const openFence: Fence = {
  slotId: 'slot-1',
  state: 'open',
  generation: 6,
  leaseId: null,
  resetAttemptId: null,
};

const consumedReceipt: Receipt = {
  slotId: 'slot-1',
  generation: 5,
  attemptId: 'attempt-500',
  seedVersion: 'v1.0.0',
  consumed: true,
};

const resettingControl: Control = {
  slotId: 'slot-1',
  status: 'resetting',
  generation: 5,
  leaseId: 'lease-100',
  resetAttemptId: 'attempt-500',
};

const fencedFence: Fence = {
  slotId: 'slot-1',
  state: 'fenced',
  generation: 5,
  leaseId: null,
  resetAttemptId: 'attempt-500',
};

const unconsumedReceipt: Receipt = {
  slotId: 'slot-1',
  generation: 5,
  attemptId: 'attempt-500',
  seedVersion: 'v1.0.0',
  consumed: false,
};

interface StateParts {
  control?: Control | null;
  fence?: Fence | null;
  receipt?: Receipt | null;
  transactionEnded?: boolean;
  authoritativeSnapshot?: boolean;
}

function buildState(parts: StateParts): AuthoritativeReleaseState {
  return {
    transactionEnded: parts.transactionEnded ?? true,
    authoritativeSnapshot: parts.authoritativeSnapshot ?? true,
    control: parts.control ?? null,
    fence: parts.fence ?? null,
    receipt: parts.receipt ?? null,
  };
}

function releasedState(parts: StateParts = {}): AuthoritativeReleaseState {
  return buildState({
    control: releasedControl,
    fence: openFence,
    receipt: consumedReceipt,
    ...parts,
  });
}

function unreleasedState(parts: StateParts = {}): AuthoritativeReleaseState {
  return buildState({
    control: resettingControl,
    fence: fencedFence,
    receipt: unconsumedReceipt,
    ...parts,
  });
}

function withEvidence(
  state: AuthoritativeReleaseState,
  outcome: EvidenceOutcome,
  evidenceIdentity: SandboxReleaseIdentity = identity,
): AuthoritativeReleaseState {
  return { ...state, releaseEvidence: { identity: evidenceIdentity, outcome } };
}

function readerFor(
  state: AuthoritativeReleaseState | null,
  shouldThrow = false,
): AuthoritativeReleaseStateReaderPort {
  return {
    readState: async () => {
      if (shouldThrow) {
        throw new Error('Database read failed');
      }
      return state;
    },
  };
}

async function reconcile(
  state: AuthoritativeReleaseState | null,
  candidate: SandboxReleaseIdentity = identity,
  shouldThrow = false,
): Promise<ReleaseReconciliationOutcome> {
  return new ReconcileUncertainRelease(readerFor(state, shouldThrow)).execute(candidate);
}

describe('ReconcileUncertainRelease', () => {
  describe('confirmed outcomes', () => {
    it('confirms a release only with committed evidence and fully released state', async () => {
      await expect(reconcile(withEvidence(releasedState(), 'committed'))).resolves.toBe(
        'confirmed_released',
      );
    });

    it('confirms a non-release only with not_committed evidence and untouched state', async () => {
      await expect(reconcile(withEvidence(unreleasedState(), 'not_committed'))).resolves.toBe(
        'confirmed_not_released',
      );
    });
  });

  describe('unreadable state fails closed', () => {
    it('returns indeterminate when the reader returns null', async () => {
      await expect(reconcile(null)).resolves.toBe('indeterminate');
    });

    it('returns indeterminate when the reader throws', async () => {
      await expect(reconcile(null, identity, true)).resolves.toBe('indeterminate');
    });

    it('returns indeterminate when the previous transaction has not ended', async () => {
      const state = withEvidence(releasedState({ transactionEnded: false }), 'committed');
      await expect(reconcile(state)).resolves.toBe('indeterminate');
    });

    it('returns indeterminate when the snapshot is not authoritative', async () => {
      const state = withEvidence(releasedState({ authoritativeSnapshot: false }), 'committed');
      await expect(reconcile(state)).resolves.toBe('indeterminate');
    });

    it.each([
      ['control', { control: null }],
      ['fence', { fence: null }],
      ['receipt', { receipt: null }],
    ])('returns indeterminate when %s is missing', async (_label, parts) => {
      const state = withEvidence(releasedState(parts as StateParts), 'committed');
      await expect(reconcile(state)).resolves.toBe('indeterminate');
    });
  });

  describe('evidence must belong to this operation', () => {
    it('returns indeterminate when no operation-bound evidence is reported', async () => {
      await expect(reconcile(releasedState())).resolves.toBe('indeterminate');
      await expect(reconcile(unreleasedState())).resolves.toBe('indeterminate');
    });

    it.each([
      ['committed evidence on an untouched slot', withEvidence(unreleasedState(), 'committed')],
      ['not_committed evidence on a released slot', withEvidence(releasedState(), 'not_committed')],
    ])('returns indeterminate for %s', async (_label, state) => {
      await expect(reconcile(state)).resolves.toBe('indeterminate');
    });

    it.each([
      ['releaseId', { releaseId: 'release-2' }],
      ['slotId', { slotId: 'slot-2' }],
      ['leaseId', { leaseId: 'lease-200' }],
      ['generation', { generation: 4 }],
      ['attemptId', { attemptId: 'attempt-600' }],
      ['seedVersion', { seedVersion: 'v2.0.0' }],
    ])(
      'returns indeterminate when evidence %s differs from the operation',
      async (_label, patch) => {
        const state = withEvidence(releasedState(), 'committed', { ...identity, ...patch });
        await expect(reconcile(state)).resolves.toBe('indeterminate');
      },
    );

    it('returns indeterminate when the operation has no release identity', async () => {
      const blank = { ...identity, releaseId: '   ' };
      const state = withEvidence(unreleasedState(), 'not_committed', blank);
      await expect(reconcile(state, blank)).resolves.toBe('indeterminate');
    });
  });

  describe('state rows must belong to the slot', () => {
    it.each([
      ['control', { control: { ...releasedControl, slotId: 'slot-2' } }],
      ['fence', { fence: { ...openFence, slotId: 'slot-2' } }],
    ])('returns indeterminate when %s belongs to another slot', async (_label, parts) => {
      const state = withEvidence(releasedState(parts as StateParts), 'committed');
      await expect(reconcile(state)).resolves.toBe('indeterminate');
    });

    it('returns indeterminate when an untouched slot row belongs to another slot', async () => {
      const state = withEvidence(
        unreleasedState({ control: { ...resettingControl, slotId: 'slot-2' } }),
        'not_committed',
      );
      await expect(reconcile(state)).resolves.toBe('indeterminate');
    });
  });

  describe('released state requires every field', () => {
    it.each([
      [
        'an unknown control status',
        { control: { ...releasedControl, status: 'unknown' as const } },
      ],
      [
        'a quarantined control status',
        { control: { ...releasedControl, status: 'quarantined' as const } },
      ],
      ['a generation that did not advance', { control: { ...releasedControl, generation: 5 } }],
      ['a retained lease', { control: { ...releasedControl, leaseId: 'lease-100' } }],
      ['a retained attempt', { control: { ...releasedControl, resetAttemptId: 'attempt-500' } }],
      ['a fenced barrier', { fence: { ...openFence, state: 'fenced' as const } }],
      ['an unknown barrier state', { fence: { ...openFence, state: 'unknown' as const } }],
      ['a barrier generation that did not advance', { fence: { ...openFence, generation: 5 } }],
      ['a barrier retaining a lease', { fence: { ...openFence, leaseId: 'lease-100' } }],
      [
        'a barrier retaining an attempt',
        { fence: { ...openFence, resetAttemptId: 'attempt-500' } },
      ],
      ['an unconsumed receipt', { receipt: { ...consumedReceipt, consumed: false } }],
      ['a receipt for another slot', { receipt: { ...consumedReceipt, slotId: 'slot-2' } }],
      ['a receipt for another generation', { receipt: { ...consumedReceipt, generation: 4 } }],
      [
        'a receipt for another attempt',
        { receipt: { ...consumedReceipt, attemptId: 'attempt-600' } },
      ],
      [
        'a receipt for another seed version',
        { receipt: { ...consumedReceipt, seedVersion: 'v2.0.0' } },
      ],
    ])('returns indeterminate for %s', async (_label, parts) => {
      const state = withEvidence(releasedState(parts as StateParts), 'committed');
      await expect(reconcile(state)).resolves.toBe('indeterminate');
    });
  });

  describe('untouched state requires every field', () => {
    it.each([
      [
        'an available control status',
        { control: { ...resettingControl, status: 'available' as const } },
      ],
      ['a control generation that advanced', { control: { ...resettingControl, generation: 6 } }],
      [
        'a control retaining another lease',
        { control: { ...resettingControl, leaseId: 'lease-200' } },
      ],
      [
        'a control retaining another attempt',
        { control: { ...resettingControl, resetAttemptId: 'attempt-600' } },
      ],
      ['an open barrier', { fence: { ...fencedFence, state: 'open' as const } }],
      ['an unknown barrier state', { fence: { ...fencedFence, state: 'unknown' as const } }],
      ['a barrier generation that advanced', { fence: { ...fencedFence, generation: 6 } }],
      [
        'a barrier retaining another attempt',
        { fence: { ...fencedFence, resetAttemptId: 'attempt-600' } },
      ],
      ['a consumed receipt', { receipt: { ...unconsumedReceipt, consumed: true } }],
      ['a receipt for another slot', { receipt: { ...unconsumedReceipt, slotId: 'slot-2' } }],
      ['a receipt for another generation', { receipt: { ...unconsumedReceipt, generation: 4 } }],
      [
        'a receipt for another attempt',
        { receipt: { ...unconsumedReceipt, attemptId: 'attempt-600' } },
      ],
      [
        'a receipt for another seed version',
        { receipt: { ...unconsumedReceipt, seedVersion: 'v2.0.0' } },
      ],
    ])('returns indeterminate for %s', async (_label, parts) => {
      const state = withEvidence(unreleasedState(parts as StateParts), 'not_committed');
      await expect(reconcile(state)).resolves.toBe('indeterminate');
    });
  });
});
