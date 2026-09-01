import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';

// Logout revocation (HIGH-1). Marks every row in the family revoked —
// current and any in-grace superseded rows alike — so "logout beats grace"
// (design.md D2) and no new access token can ever be minted from this
// session again.
export class RevokeRefreshTokenUseCase {
  constructor(private readonly rememberTokenRepo: RememberTokenRepositoryPort) {}

  async execute(familyId: string): Promise<number> {
    return this.rememberTokenRepo.revokeFamily(familyId);
  }
}
