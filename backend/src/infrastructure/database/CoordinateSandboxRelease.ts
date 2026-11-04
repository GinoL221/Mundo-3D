import type { TransactionContext, UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';
import type {
  AuthoritativeReleaseState,
  AuthoritativeReleaseSessionReaderPort,
  SandboxReleaseIdentity,
} from '../../domain/ports/AuthoritativeReleaseStateReaderPort';
import type {
  RecordedReleaseSession,
  SandboxReleaseSessionRecorderPort,
} from '../../domain/ports/SandboxReleaseSessionRecorderPort';
import type { SandboxReleaseOperationRecorderPort } from '../../domain/ports/SandboxReleaseOperationRecorderPort';
import { ReleaseSandboxInTransaction } from '../../application/use-cases/ReleaseSandboxInTransaction';
import type {
  SandboxReleaseControl,
  SandboxReleaseFence,
  SandboxReleaseReceipt,
} from '../../application/use-cases/ReleaseSandboxInTransaction';

/** Reads the raw MySQL session id of the connection a transaction is running on. */
export interface ReleaseConnectionIdentityReader {
  current(context: TransactionContext): Promise<string>;
}

export interface CoordinateSandboxReleaseOutcome {
  readonly outcome: 'released' | 'rejected' | 'uncertain';
  readonly recorded: RecordedReleaseSession;
}

export interface CoordinateSandboxReleasePorts {
  /** The base unit of work over the dedicated slot connection. */
  uow: UnitOfWorkPort;
  sessions: SandboxReleaseSessionRecorderPort;
  connectionId: ReleaseConnectionIdentityReader;
  control: SandboxReleaseControl;
  fence: SandboxReleaseFence;
  receipts: SandboxReleaseReceipt;
  releaseRecorder: SandboxReleaseOperationRecorderPort;
  reader: AuthoritativeReleaseSessionReaderPort;
}

/**
 * Unwired orchestrator composing the reviewed release components over one
 * dedicated connection (L154 contract, evidence L155). It records the session
 * identity first, then runs the release seam inside a continuity-guarded unit
 * of work: the transaction's live `CONNECTION_ID()` must match the recorded
 * id, so a pooled sibling, a reconnected raw socket or any other drift rolls
 * the transaction back into `uncertain` instead of trusting a stale session
 * record. Reconciliation delegates to the authoritative reader with the
 * recorded session. Nothing here pins the raw connection itself or proves the
 * deployment topology; the caller must supply a slot connection whose pool
 * cannot migrate the raw connection while this orchestrator runs.
 */
export class CoordinateSandboxRelease {
  private readonly control: SandboxReleaseControl;
  private readonly reader: AuthoritativeReleaseSessionReaderPort;

  constructor(private readonly ports: CoordinateSandboxReleasePorts) {
    this.control = ports.control;
    this.reader = ports.reader;
  }

  async execute(identity: SandboxReleaseIdentity): Promise<CoordinateSandboxReleaseOutcome> {
    const recorded = await this.ports.sessions.recordSession(identity);
    const guardedUow: UnitOfWorkPort = {
      runInTransaction: async <T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> =>
        this.ports.uow.runInTransaction(async (tx) => {
          const current = await this.ports.connectionId.current(tx);
          if (current !== recorded.connectionId) {
            throw new Error(
              `Release connection continuity lost: recorded ${recorded.connectionId}, running ${current}`,
            );
          }
          return work(tx);
        }),
    };
    const seam = new ReleaseSandboxInTransaction(
      guardedUow,
      this.ports.control,
      this.ports.fence,
      this.ports.receipts,
      this.ports.releaseRecorder,
    );
    return { outcome: await seam.execute(identity), recorded };
  }

  reconcile(
    identity: SandboxReleaseIdentity,
    session: RecordedReleaseSession,
  ): Promise<AuthoritativeReleaseState | null> {
    return this.reader.readState(identity, session);
  }
}
