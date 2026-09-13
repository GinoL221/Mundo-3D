import { EmailConfirmationToken } from '../entities/EmailConfirmationToken';
import { TransactionContext } from './UnitOfWorkPort';

export interface EmailConfirmationTokenReplacement {
  token: EmailConfirmationToken;
  recipient: string;
}

export interface EmailConfirmationTokenRepositoryPort {
  replaceForUnverifiedUser(input: {
    userId: number;
    tokenHash: string;
    now: Date;
    tx: TransactionContext;
  }): Promise<EmailConfirmationTokenReplacement | null>;
  findUserIdByTokenHash(tokenHash: string): Promise<number | null>;
  verifyAndConsume(input: {
    userId: number;
    tokenHash: string;
    now: Date;
    tx: TransactionContext;
  }): Promise<{
    outcome: 'confirmed' | 'idempotent' | 'invalid' | 'unknown' | 'expired' | 'superseded';
  }>;
}
