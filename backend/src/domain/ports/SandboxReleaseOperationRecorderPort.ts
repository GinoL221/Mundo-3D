import type { TransactionContext } from './UnitOfWorkPort';
import type { SandboxReleaseIdentity } from './AuthoritativeReleaseStateReaderPort';

/**
 * Writes and reads the durable release record. A row only exists after the
 * release transaction committed, so it must be written inside that transaction.
 * Enforcing the transaction, its locks and the storage uniqueness is the
 * adapter's responsibility; no implementation here proves any of it.
 */
export interface SandboxReleaseOperationRecorderPort {
  record(identity: SandboxReleaseIdentity, context: TransactionContext): Promise<void>;
  exists(identity: SandboxReleaseIdentity, context: TransactionContext): Promise<boolean>;
}
