import { IRememberTokenRepository } from '../../domain/ports/IRememberTokenRepository';
import { ITokenHasher } from '../../domain/ports/ITokenHasher';

export class DeleteRememberTokenUseCase {
  constructor(
    private readonly rememberTokenRepo: IRememberTokenRepository,
    private readonly tokenHasher: ITokenHasher
  ) {}

  async execute(plainToken: string): Promise<boolean> {
    const hashedToken = this.tokenHasher.hash(plainToken);
    return this.rememberTokenRepo.deleteByHash(hashedToken);
  }
}
