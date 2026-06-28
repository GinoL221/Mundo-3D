// @ts-expect-error: bcryptjs does not provide native TypeScript types in all environments
import bcryptjs from 'bcryptjs';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';

export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly saltRounds = 10;

  async hash(plain: string): Promise<string> {
    return bcryptjs.hash(plain, this.saltRounds);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcryptjs.compare(plain, hashed);
  }
}
