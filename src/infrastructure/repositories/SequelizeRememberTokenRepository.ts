import { RememberToken } from '../../domain/entities/RememberToken';
import { IRememberTokenRepository } from '../../domain/ports/IRememberTokenRepository';
import db, { RememberTokenInstance } from '../../database/models/db';

export class SequelizeRememberTokenRepository implements IRememberTokenRepository {
  private toEntity(instance: RememberTokenInstance): RememberToken {
    return new RememberToken(
      instance.idRememberToken,
      instance.tokenHash,
      instance.idUser,
      new Date(instance.expiryDate),
      instance.createdAt ? new Date(instance.createdAt) : null
    );
  }

  async create(token: Omit<RememberToken, 'idRememberToken'>): Promise<RememberToken> {
    const instance = await db.RememberToken.create({
      idUser: token.idUser,
      tokenHash: token.tokenHash,
      expiryDate: token.expiryDate,
      createdAt: token.createdAt || new Date(),
    } as any);
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
}
