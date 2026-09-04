import { QueryTypes, Transaction, Op, literal } from 'sequelize';
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

  // The cutoff is computed by the DATABASE, not by Node. `claimRotation`
  // writes `superseded_at` with MySQL's own NOW(), so comparing it against a
  // Node-side `new Date(...)` puts two different clocks on either side of the
  // predicate — and with no `timezone` configured in Sequelize, any offset
  // makes the comparison false forever and nothing is ever deleted. CI proved
  // exactly that: the reaper deleted zero rows. Keeping both sides on the
  // server clock is what makes this correct; it is not a stylistic preference
  // for raw SQL.
  //
  // A NULL `superseded_at` never satisfies `<`, so the current row and any
  // row still inside the retention cutoff are never touched. `destroy()` is kept
  // over a raw DELETE because Sequelize's mysql dialect special-cases
  // `QueryTypes.UPDATE` to return `[result, affectedRows]` but gives plain
  // DELETE no such treatment, so the ORM's row count is the unambiguous one.
  //
  // `<=`, not `<`, because `superseded_at` is a second-precision `datetime`.
  // A rotation and the reap that follows it commonly land in the SAME second,
  // so a strict `<` compares a timestamp against itself and matches nothing —
  // which is exactly how CI caught this the second time. `<=` also states the
  // intended rule correctly: a row whose retention cutoff has fully elapsed is
  // reapable, and at the boundary it has elapsed.
  //
  // `retentionSeconds` is the caller's retention cutoff, NOT the grace window;
  // the two were once the same value, and that is precisely what deleted the
  // rows reuse detection reads. It is interpolated into the interval, so it is
  // coerced to a non-negative integer first: a truncated finite number cannot
  // carry SQL.
  async reapFamily(familyId: string, retentionSeconds: number, tx: TransactionContext): Promise<number> {
    const transaction = tx as unknown as Transaction;
    const cutoff = Number.isFinite(retentionSeconds) ? Math.max(0, Math.trunc(retentionSeconds)) : 0;

    return db.RememberToken.destroy({
      where: {
        familyId,
        supersededAt: { [Op.lte]: literal(`NOW() - INTERVAL ${cutoff} SECOND`) },
      },
      transaction,
    });
  }
}
