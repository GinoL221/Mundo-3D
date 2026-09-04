// @ts-expect-error: bcryptjs does not provide native TypeScript types in all environments
import bcryptjs from 'bcryptjs';
import { PasswordHasherPort } from '../../domain/ports/PasswordHasherPort';

export class BcryptPasswordHasher implements PasswordHasherPort {
  private readonly saltRounds = 10;

  // A real bcrypt hash at `saltRounds`, of 32 random bytes generated once and
  // never recorded. It is not a secret and not a credential: no account holds
  // it and nothing can match it. Its whole job is to give `compareAgainstDecoy`
  // something genuine to work on.
  //
  // The cost factor here MUST track `saltRounds`. A decoy at a lower cost
  // returns sooner than a real comparison and hands back the timing difference
  // this exists to erase.
  private readonly decoyHash = '$2a$10$tM.qhKiK276DG5gfyqqFR.FZnbof.TsKO6ZKasiRYLN/VHB/GF5au';

  async hash(plain: string): Promise<string> {
    return bcryptjs.hash(plain, this.saltRounds);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcryptjs.compare(plain, hashed);
  }

  async compareAgainstDecoy(plain: string): Promise<void> {
    // A real comparison against a hash that cannot match, not a sleep: the
    // work has to be the same work, on the same input length, or it diverges
    // from a genuine compare under load in ways a fixed delay would not.
    await bcryptjs.compare(plain, this.decoyHash);
  }
}
