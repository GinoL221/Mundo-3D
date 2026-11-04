import type { TransactionContext } from './UnitOfWorkPort';

export interface SandboxResetIdentity {
  readonly slotId: string;
  readonly generation: number;
  readonly attemptId: string;
  readonly seedVersion: string;
}

export interface SandboxResetReceiptConsumerPort {
  consume(identity: SandboxResetIdentity, context: TransactionContext): Promise<boolean>;
}
