import crypto from 'crypto';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';

export class Sha256TokenHasher implements TokenHasherPort {
  hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
