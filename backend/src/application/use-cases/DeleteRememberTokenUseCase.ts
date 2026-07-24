import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';

export class DeleteRememberTokenUseCase {
  constructor(
    private readonly rememberTokenRepo: RememberTokenRepositoryPort,
    private readonly tokenHasher: TokenHasherPort
  ) {}

  async execute(plainToken: string): Promise<boolean> {
    const hashedToken = this.tokenHasher.hash(plainToken);
    return this.rememberTokenRepo.deleteByHash(hashedToken);
  }
}
