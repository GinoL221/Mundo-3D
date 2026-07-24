// @ts-expect-error: bcryptjs does not provide native TypeScript types in all environments
import bcryptjs from 'bcryptjs';
import { PasswordHasherPort } from '../../domain/ports/PasswordHasherPort';

export class BcryptPasswordHasher implements PasswordHasherPort {
  private readonly saltRounds = 10;

  async hash(plain: string): Promise<string> {
    return bcryptjs.hash(plain, this.saltRounds);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcryptjs.compare(plain, hashed);
  }
}
