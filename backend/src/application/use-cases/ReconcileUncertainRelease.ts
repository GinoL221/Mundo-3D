import type {
  AuthoritativeReleaseState,
  AuthoritativeReleaseStateReaderPort,
  SandboxReleaseIdentity,
} from '../../domain/ports/AuthoritativeReleaseStateReaderPort';

export type ReleaseReconciliationOutcome =
  | 'confirmed_released'
  | 'confirmed_not_released'
  | 'indeterminate';

export class ReconcileUncertainRelease {
  constructor(private readonly reader: AuthoritativeReleaseStateReaderPort) {}

  async execute(identity: SandboxReleaseIdentity): Promise<ReleaseReconciliationOutcome> {
    let state: AuthoritativeReleaseState | null;
    try {
      state = await this.reader.readState(identity);
    } catch {
      return 'indeterminate';
    }

    if (!state) {
      return 'indeterminate';
    }

    if (!state.transactionEnded || !state.authoritativeSnapshot) {
      return 'indeterminate';
    }

    const { control, fence, receipt, releaseEvidence } = state;
    const evidenceIdentity = releaseEvidence?.identity;
    if (
      !identity.releaseId?.trim() ||
      !evidenceIdentity ||
      evidenceIdentity.releaseId !== identity.releaseId ||
      evidenceIdentity.slotId !== identity.slotId ||
      evidenceIdentity.leaseId !== identity.leaseId ||
      evidenceIdentity.generation !== identity.generation ||
      evidenceIdentity.attemptId !== identity.attemptId ||
      evidenceIdentity.seedVersion !== identity.seedVersion
    ) {
      return 'indeterminate';
    }
    if (!control || !fence || !receipt) {
      return 'indeterminate';
    }

    if (
      releaseEvidence.outcome === 'committed' &&
      this.isConfirmedReleased(identity, control, fence, receipt)
    ) {
      return 'confirmed_released';
    }

    if (
      releaseEvidence.outcome === 'not_committed' &&
      this.isConfirmedNotReleased(identity, control, fence, receipt)
    ) {
      return 'confirmed_not_released';
    }

    return 'indeterminate';
  }

  private isConfirmedReleased(
    identity: SandboxReleaseIdentity,
    control: NonNullable<AuthoritativeReleaseState['control']>,
    fence: NonNullable<AuthoritativeReleaseState['fence']>,
    receipt: NonNullable<AuthoritativeReleaseState['receipt']>,
  ): boolean {
    const isControlReleased =
      control.slotId === identity.slotId &&
      control.status === 'available' &&
      control.generation === identity.generation + 1 &&
      control.leaseId === null &&
      control.resetAttemptId === null;

    const isFenceReleased =
      fence.slotId === identity.slotId &&
      fence.state === 'open' &&
      fence.generation === identity.generation + 1 &&
      fence.leaseId === null &&
      fence.resetAttemptId === null;

    const isReceiptConsumed =
      receipt.slotId === identity.slotId &&
      receipt.generation === identity.generation &&
      receipt.attemptId === identity.attemptId &&
      receipt.seedVersion === identity.seedVersion &&
      receipt.consumed === true;

    return isControlReleased && isFenceReleased && isReceiptConsumed;
  }

  private isConfirmedNotReleased(
    identity: SandboxReleaseIdentity,
    control: NonNullable<AuthoritativeReleaseState['control']>,
    fence: NonNullable<AuthoritativeReleaseState['fence']>,
    receipt: NonNullable<AuthoritativeReleaseState['receipt']>,
  ): boolean {
    const isControlUnreleased =
      control.slotId === identity.slotId &&
      control.status === 'resetting' &&
      control.generation === identity.generation &&
      control.leaseId === identity.leaseId &&
      control.resetAttemptId === identity.attemptId;

    const isFenceUnreleased =
      fence.slotId === identity.slotId &&
      fence.state === 'fenced' &&
      fence.generation === identity.generation &&
      fence.resetAttemptId === identity.attemptId;

    const isReceiptUnconsumed =
      receipt.slotId === identity.slotId &&
      receipt.generation === identity.generation &&
      receipt.attemptId === identity.attemptId &&
      receipt.seedVersion === identity.seedVersion &&
      receipt.consumed === false;

    return isControlUnreleased && isFenceUnreleased && isReceiptUnconsumed;
  }
}
