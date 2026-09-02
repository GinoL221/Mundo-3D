import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';
import { UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';
import { RefreshTokenRotatorPort } from '../../domain/ports/RefreshTokenRotatorPort';
import { RememberToken } from '../../domain/entities/RememberToken';
import { REFRESH_TOKEN_GRACE_SECONDS } from '../../domain/entities/RefreshTokenGrace';
import { RefreshTokenRotationLostRaceError } from '../../domain/exceptions/RefreshTokenRotationLostRaceError';

// Re-exported for backward compatibility (PR1's own test file imports both
// from this module). Canonical source is now domain/ — see
// RefreshTokenRotatorPort.ts's comment for why (backend.application.contracts
// forbids RefreshSessionUseCase, PR2, from importing this file directly).
export { RefreshTokenRotationLostRaceError };
export const GRACE_SECONDS = REFRESH_TOKEN_GRACE_SECONDS;

// design.md D1: one transaction, three steps — claim (the authoritative
// gate), insert successor (same family, same user, expiry inherited
// verbatim, never extended), reap (delete this family's past-grace rows).
// Only the rotation winner ever reaches step 2/3. Implements
// RefreshTokenRotatorPort so RefreshSessionUseCase (PR2) can depend on the
// port instead of this concrete class.
export class RotateRefreshTokenUseCase implements RefreshTokenRotatorPort {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly rememberTokenRepo: RememberTokenRepositoryPort,
    private readonly tokenHasher: TokenHasherPort
  ) {}

  async execute(current: RememberToken, newPlainToken: string): Promise<RememberToken> {
    const successorHash = this.tokenHasher.hash(newPlainToken);

    return this.uow.runInTransaction(async (tx) => {
      const claimed = await this.rememberTokenRepo.claimRotation({
        presentedHash: current.tokenHash,
        successorHash,
        tx,
      });

      if (!claimed) {
        throw new RefreshTokenRotationLostRaceError();
      }

      if (!current.familyId) {
        throw new Error('Cannot rotate a RememberToken row with no familyId');
      }

      const successor = await this.rememberTokenRepo.insertSuccessor(
        new RememberToken(0, successorHash, current.idUser, current.expiryDate, undefined, current.familyId),
        tx
      );

      await this.rememberTokenRepo.reapFamily(current.familyId, GRACE_SECONDS, tx);

      return successor;
    });
  }
}
