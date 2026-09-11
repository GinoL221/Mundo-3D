import { Transaction } from 'sequelize';
import { EmailConfirmationToken } from '../../domain/entities/EmailConfirmationToken';
import {
  EmailConfirmationTokenReplacement,
  EmailConfirmationTokenRepositoryPort,
} from '../../domain/ports/EmailConfirmationTokenRepositoryPort';
import { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import db, {
  EmailConfirmationTokenAttributes,
  EmailConfirmationTokenInstance,
} from '../../database/models/db';

export class SequelizeEmailConfirmationTokenRepository implements EmailConfirmationTokenRepositoryPort {
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
    // SAFETY: SequelizeUnitOfWork creates this opaque context from a Sequelize Transaction.
    const transaction = tx as unknown as Transaction;
    const user = await db.User.findByPk(userId, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    if (!user || user.emailVerifiedAt) {
      return null;
    }

    await db.EmailConfirmationToken.update(
      { invalidatedAt: now, activeSlot: null } as Partial<EmailConfirmationTokenAttributes>,
      {
        where: { idUser: userId, activeSlot: 1 },
        transaction,
      },
    );

    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const instance = await db.EmailConfirmationToken.create(
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
