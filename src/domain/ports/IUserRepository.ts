import { User } from '../entities/User';

export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, 'IDUser'>): Promise<User>;
  findAll(): Promise<User[]>;
}
