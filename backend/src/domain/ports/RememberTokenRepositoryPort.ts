import { RememberToken } from '../entities/RememberToken';

export interface RememberTokenRepositoryPort {
  create(token: Omit<RememberToken, 'idRememberToken'>): Promise<RememberToken>;
  findByHash(hash: string): Promise<RememberToken | null>;
  deleteByHash(hash: string): Promise<boolean>;
}
