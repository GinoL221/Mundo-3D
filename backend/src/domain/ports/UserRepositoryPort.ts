import { User } from '../entities/User';

export interface UserRepositoryPort {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, 'idUser'>): Promise<User>;
  findAll(): Promise<User[]>;
}
