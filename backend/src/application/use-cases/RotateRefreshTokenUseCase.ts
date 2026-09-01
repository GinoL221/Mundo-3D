import { RememberTokenRepositoryPort } from '../../domain/ports/RememberTokenRepositoryPort';
import { UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';
import { TokenHasherPort } from '../../domain/ports/TokenHasherPort';
import { RememberToken } from '../../domain/entities/RememberToken';

// Matches D7's grace window (30s) — the same constant `RefreshSessionUseCase`
// (PR2) will use to recognize an in-grace hit.
const GRACE_SECONDS = 30;

// Thrown when the conditional-UPDATE claim (design.md D1) affects zero
// rows: the presented token is no longer current (already rotated,
// revoked, or expired between the caller's read and this call). The
// transaction rolls back; the caller must re-read the row OUTSIDE this
// aborted transaction to decide whether it's now a grace hit or a genuine
// 401 (see `RefreshSessionUseCase`, PR2).
export class RefreshTokenRotationLostRaceError extends Error {
  constructor() {
    super('Refresh token rotation lost the race — the presented token is no longer current');
    this.name = 'RefreshTokenRotationLostRaceError';
  }
}

// design.md D1: one transaction, three steps — claim (the authoritative
// gate), insert successor (same family, same user, expiry inherited
// verbatim, never extended), reap (delete this family's past-grace rows).
// Only the rotation winner ever reaches step 2/3.
export class RotateRefreshTokenUseCase {
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
