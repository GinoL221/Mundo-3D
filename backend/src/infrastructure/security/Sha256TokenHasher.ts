import crypto from 'crypto';
import { ITokenHasher } from '../../domain/ports/ITokenHasher';

export class Sha256TokenHasher implements ITokenHasher {
  hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
