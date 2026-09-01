import crypto from 'crypto';
import { IdGeneratorPort } from '../../domain/ports/IdGeneratorPort';

export class CryptoRandomIdGenerator implements IdGeneratorPort {
  generate(): string {
    return crypto.randomUUID();
  }
}
