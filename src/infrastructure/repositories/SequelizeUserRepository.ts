import { User } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import db, { UserInstance } from '../../database/models/db';

export class SequelizeUserRepository implements IUserRepository {
  private toEntity(instance: UserInstance): User {
    return new User(
      instance.IDUser,
      instance.FirstName,
      instance.LastName,
      instance.Email,
      instance.PasswordUser,
      instance.Image || null,
      (instance as any).IDRole || null,
      (instance as any).Category || null
    );
  }

  async findById(id: number): Promise<User | null> {
    const instance = await db.User.findByPk(id);
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async findByEmail(email: string): Promise<User | null> {
    const instance = await db.User.findOne({
      where: { Email: email },
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async create(user: Omit<User, 'IDUser'>): Promise<User> {
    const instance = await db.User.create({
      FirstName: user.FirstName,
      LastName: user.LastName,
      Email: user.Email,
      PasswordUser: user.Password,
      Image: user.Image,
    } as any);
    return this.toEntity(instance);
  }
}
