import { RememberToken } from '../../domain/entities/RememberToken';
import { IRememberTokenRepository } from '../../domain/ports/IRememberTokenRepository';
import db, { RememberTokenInstance } from '../../database/models/db';

export class SequelizeRememberTokenRepository implements IRememberTokenRepository {
  private toEntity(instance: RememberTokenInstance): RememberToken {
    return new RememberToken(
      instance.id,
      instance.TokenHash,
      instance.IDUser,
      new Date(instance.ExpiresAt),
      (instance as any).CreatedAt ? new Date((instance as any).CreatedAt) : null
    );
  }

  async create(token: Omit<RememberToken, 'IDRememberToken'>): Promise<RememberToken> {
    const instance = await db.RememberToken.create({
      IDUser: token.IDUser,
      TokenHash: token.TokenHash,
      ExpiresAt: token.ExpiryDate,
    } as any);
    return this.toEntity(instance);
  }

  async findByHash(hash: string): Promise<RememberToken | null> {
    const instance = await db.RememberToken.findOne({
      where: { TokenHash: hash },
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async deleteByHash(hash: string): Promise<boolean> {
    const deletedCount = await db.RememberToken.destroy({
      where: { TokenHash: hash },
    });
    return deletedCount > 0;
  }
}
