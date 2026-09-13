import crypto from 'crypto';
import { ConfirmationTokenGeneratorPort } from '../../domain/ports/ConfirmationTokenGeneratorPort';

export class CryptoConfirmationTokenGenerator implements ConfirmationTokenGeneratorPort {
  generate(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}
