import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';

// Logout revocation (HIGH-1). Marks every row in the family revoked —
// current and any in-grace superseded rows alike — so "logout beats grace"
// (design.md D2) and no new access token can ever be minted from this
// session again.
export class RevokeRefreshTokenUseCase {
  constructor(
    private readonly rememberTokenRepo: RememberTokenRepositoryPort,
    private readonly tokenHasher?: TokenHasherPort
  ) {}

  async execute(familyId: string): Promise<number> {
    return this.rememberTokenRepo.revokeFamily(familyId);
  }

  async revokeByToken(plainToken: string): Promise<number> {
    if (!this.tokenHasher) {
      throw new Error('TokenHasherPort not injected');
    }
    const hash = this.tokenHasher.hash(plainToken);
    const token = await this.rememberTokenRepo.findByHash(hash);
    if (!token || !token.familyId) {
      return 0;
    }
    return this.rememberTokenRepo.revokeFamily(token.familyId);
  }
}

