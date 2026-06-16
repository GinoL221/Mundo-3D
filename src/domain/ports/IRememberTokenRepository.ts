import { RememberToken } from '../entities/RememberToken';

export interface IRememberTokenRepository {
  create(token: Omit<RememberToken, 'IDRememberToken'>): Promise<RememberToken>;
  findByHash(hash: string): Promise<RememberToken | null>;
  deleteByHash(hash: string): Promise<boolean>;
}
