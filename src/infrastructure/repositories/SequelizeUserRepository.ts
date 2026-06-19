import { User } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import db, { UserInstance } from '../../database/models/db';

export class SequelizeUserRepository implements IUserRepository {
  private toEntity(instance: UserInstance): User {
    return new User(
      instance.idUser,
      instance.firstName,
      instance.lastName,
      instance.email,
      instance.passwordUser,
      instance.image || null,
      instance.idRole || null,
      instance.category || null
    );
  }

  async findById(id: number): Promise<User | null> {
    const instance = await db.User.findByPk(id);
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async findByEmail(email: string): Promise<User | null> {
    const instance = await db.User.findOne({
      where: { email: email },
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async create(user: Omit<User, 'idUser'>): Promise<User> {
    const instance = await db.User.create({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      passwordUser: user.password,
      image: user.image,
    } as any);
    return this.toEntity(instance);
  }

  async findAll(): Promise<User[]> {
    const instances = await db.User.findAll();
    return instances.map(instance => this.toEntity(instance));
  }
}
