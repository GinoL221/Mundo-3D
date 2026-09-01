import { QueryTypes, Transaction, Op } from 'sequelize';
import { RememberToken } from '../../domain/entities/RememberToken';
import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';
import { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import db, { RememberTokenInstance, RememberTokenAttributes } from '../../database/models/db';

export class SequelizeRememberTokenRepository implements RememberTokenRepositoryPort {
  private toEntity(instance: RememberTokenInstance): RememberToken {
    return new RememberToken(
      instance.idRememberToken,
      instance.tokenHash,
      instance.idUser,
      new Date(instance.expiryDate),
      instance.createdAt ? new Date(instance.createdAt) : null,
      instance.familyId ?? null,
      instance.supersededAt ? new Date(instance.supersededAt) : null,
      instance.successorHash ?? null,
      instance.revokedAt ? new Date(instance.revokedAt) : null
    );
  }

  async create(token: Omit<RememberToken, 'idRememberToken'>): Promise<RememberToken> {
    const instance = await db.RememberToken.create({
      idUser: token.idUser,
      tokenHash: token.tokenHash,
      expiryDate: token.expiryDate,
      createdAt: token.createdAt || new Date(),
      familyId: token.familyId,
    } as Partial<RememberTokenAttributes>);
    return this.toEntity(instance);
  }

  async findByHash(hash: string): Promise<RememberToken | null> {
    const instance = await db.RememberToken.findOne({
      where: { tokenHash: hash },
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async deleteByHash(hash: string): Promise<boolean> {
    const deletedCount = await db.RememberToken.destroy({
      where: { tokenHash: hash },
    });
    return deletedCount > 0;
  }

  // The authoritative claim gate (design.md D1): a single conditional
  // UPDATE, the `SequelizeProductRepository.adjustStock` precedent. The
  // loser sees `affectedRows === 0` because it re-evaluates
  // `superseded_at IS NULL` after the winner's transaction commits and
  // releases the row lock (InnoDB semi-consistent read) — no `SELECT ...
  // FOR UPDATE` round trip needed.
  async claimRotation(input: {
    presentedHash: string;
    successorHash: string;
    tx: TransactionContext;
  }): Promise<boolean> {
    const transaction = input.tx as unknown as Transaction;

    const [, affectedRows] = await db.sequelize.query(
      'UPDATE `RememberToken` SET `superseded_at` = NOW(), `successor_hash` = :successorHash ' +
        'WHERE `token_hash` = :presentedHash AND `superseded_at` IS NULL ' +
        'AND `revoked_at` IS NULL AND `expiry_date` > NOW()',
      {
        replacements: { presentedHash: input.presentedHash, successorHash: input.successorHash },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );

    return affectedRows === 1;
  }

  async insertSuccessor(row: RememberToken, tx: TransactionContext): Promise<RememberToken> {
    const transaction = tx as unknown as Transaction;

    const instance = await db.RememberToken.create(
      {
        idUser: row.idUser,
        tokenHash: row.tokenHash,
        expiryDate: row.expiryDate,
        familyId: row.familyId,
        createdAt: new Date(),
      } as Partial<RememberTokenAttributes>,
      { transaction }
    );

    return this.toEntity(instance);
  }

  // Not tx-scoped by design (see the port) — logout revokes outside any
  // rotation transaction, and a single UPDATE is already atomic.
  async revokeFamily(familyId: string): Promise<number> {
    const [affectedRows] = await db.RememberToken.update(
      { revokedAt: new Date() } as Partial<RememberTokenAttributes>,
      { where: { familyId, revokedAt: null } }
    );
    return affectedRows;
  }

  // ORM-level delete with a computed cutoff, rather than design.md's literal
  // `NOW() - INTERVAL :graceSeconds SECOND` raw SQL: `Op.lt` against a JS
  // Date is equivalent (NULL `superseded_at` never satisfies `<`, so the
  // current row and any in-grace row are never touched) and avoids
  // Sequelize's ambiguous return shape for a raw `QueryTypes.DELETE`
  // (unlike UPDATE, plain DELETE isn't special-cased to `[result,
  // affectedRows]` in the mysql dialect — see SequelizeRememberTokenRepository
  // apply-progress notes).
  async reapFamily(familyId: string, graceSeconds: number, tx: TransactionContext): Promise<number> {
    const transaction = tx as unknown as Transaction;
    const cutoff = new Date(Date.now() - graceSeconds * 1000);

    return db.RememberToken.destroy({
      where: {
        familyId,
        supersededAt: { [Op.lt]: cutoff },
      },
      transaction,
    });
  }
}
