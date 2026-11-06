import { resolveScopedTransaction } from '../persistence/scopedTransactionContext';
import { Transaction } from 'sequelize';
import { EmailConfirmationToken } from '../../domain/entities/EmailConfirmationToken';
import {
  EmailConfirmationTokenReplacement,
  EmailConfirmationTokenRepositoryPort,
} from '../../domain/ports/EmailConfirmationTokenRepositoryPort';
import { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import type {
  EmailConfirmationTokenAttributes,
  EmailConfirmationTokenInstance,
} from '../../database/models/db';

export type EmailConfirmationPersistence = Pick<
  typeof import('../../database/models/db'),
  'User' | 'EmailConfirmationToken' | 'sequelize'
>;

export class ScopedSequelizeEmailConfirmationTokenRepository implements EmailConfirmationTokenRepositoryPort {
  constructor(protected readonly db: EmailConfirmationPersistence) {}

  protected transactionFor(context: TransactionContext): Transaction {
    const transaction = resolveScopedTransaction(context, this.db.sequelize);
    if (!transaction) throw new Error('Transaction context is not active for this connection');
    return transaction;
  }

  private toEntity(instance: EmailConfirmationTokenInstance): EmailConfirmationToken {
    return new EmailConfirmationToken(
      instance.idEmailConfirmationToken,
      instance.idUser,
      instance.tokenHash,
      new Date(instance.expiresAt),
      instance.consumedAt ? new Date(instance.consumedAt) : null,
      instance.invalidatedAt ? new Date(instance.invalidatedAt) : null,
      instance.activeSlot,
      new Date(instance.createdAt),
    );
  }

  async findUserIdByTokenHash(tokenHash: string): Promise<number | null> {
    const token = await this.db.EmailConfirmationToken.findOne({
      where: { tokenHash },
      attributes: ['idUser'],
    });
    return token?.idUser ?? null;
  }

  async verifyAndConsume({
    userId,
    tokenHash,
    now,
    tx,
  }: {
    userId: number;
    tokenHash: string;
    now: Date;
    tx: TransactionContext;
  }): Promise<{ outcome: 'confirmed' | 'idempotent' | 'invalid' }> {
    // This user-first lock serializes confirmation with token replacement.
    const transaction = this.transactionFor(tx);
    const user = await this.db.User.findByPk(userId, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!user) {
      return { outcome: 'invalid' };
    }

    const token = await this.db.EmailConfirmationToken.findOne({
      where: { tokenHash },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!token || token.idUser !== userId) {
      return { outcome: 'invalid' };
    }
    if (token.consumedAt) {
      return { outcome: user.emailVerifiedAt ? 'idempotent' : 'invalid' };
    }
    if (
      user.emailVerifiedAt ||
      token.invalidatedAt ||
      token.activeSlot !== 1 ||
      token.expiresAt <= now
    ) {
      return { outcome: 'invalid' };
    }

    await user.update({ emailVerifiedAt: now }, { transaction });
    await token.update({ consumedAt: now, activeSlot: null }, { transaction });
    return { outcome: 'confirmed' };
  }

  async replaceForUnverifiedUser({
    userId,
    tokenHash,
    now,
    tx,
  }: {
    userId: number;
    tokenHash: string;
    now: Date;
    tx: TransactionContext;
  }): Promise<EmailConfirmationTokenReplacement | null> {
    const transaction = this.transactionFor(tx);
    const user = await this.db.User.findByPk(userId, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    if (!user || user.emailVerifiedAt) {
      return null;
    }

    await this.db.EmailConfirmationToken.update(
      { invalidatedAt: now, activeSlot: null } as Partial<EmailConfirmationTokenAttributes>,
      {
        where: { idUser: userId, activeSlot: 1 },
        transaction,
      },
    );

    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const instance = await this.db.EmailConfirmationToken.create(
      {
        idUser: userId,
        tokenHash,
        expiresAt,
        consumedAt: null,
        invalidatedAt: null,
        activeSlot: 1,
        createdAt: now,
      } as Partial<EmailConfirmationTokenAttributes>,
      { transaction },
    );

    return { token: this.toEntity(instance), recipient: user.email };
  }
}
