import type { SandboxResetIdentity } from './SandboxResetReceiptConsumerPort';
import type { RecordedReleaseSession } from './SandboxReleaseSessionRecorderPort';

export interface SandboxReleaseIdentity extends SandboxResetIdentity {
  readonly leaseId: string;
  readonly releaseId: string;
}

export interface AuthoritativeReleaseState {
  readonly transactionEnded: boolean;
  readonly authoritativeSnapshot: boolean;
  /** Abstract evidence only: a real reader must prove its durability and provenance. */
  readonly releaseEvidence?: {
    readonly identity: SandboxReleaseIdentity;
    readonly outcome: 'committed' | 'not_committed';
  };
  readonly control: {
    readonly slotId: string;
    readonly status: 'resetting' | 'available' | 'quarantined' | 'draining' | 'leased' | 'unknown';
    readonly generation: number;
    readonly leaseId: string | null;
    readonly resetAttemptId: string | null;
  } | null;
  readonly fence: {
    readonly slotId: string;
    readonly state: 'open' | 'fenced' | 'unknown';
    readonly generation: number;
    readonly leaseId: string | null;
    readonly resetAttemptId: string | null;
  } | null;
  readonly receipt: {
    readonly slotId: string;
    readonly generation: number;
    readonly attemptId: string;
    readonly seedVersion: string;
    readonly consumed: boolean;
  } | null;
}

export interface AuthoritativeReleaseStateReaderPort {
  readState(identity: SandboxReleaseIdentity): Promise<AuthoritativeReleaseState | null>;
}

/**
 * Session-aware read side of reconciliation: the caller supplies the recorded
 * release session (server uuid + connection id) produced before the release
 * transaction started. The adapter proves durability and provenance; this
 * declaration alone does not.
 */
export interface AuthoritativeReleaseSessionReaderPort {
  readState(identity: SandboxReleaseIdentity, session: RecordedReleaseSession): Promise<AuthoritativeReleaseState | null>;
}
