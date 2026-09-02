// Thrown when the conditional-UPDATE claim (design.md D1) affects zero rows:
// the presented token is no longer current (already rotated, revoked, or
// expired between the caller's read and this call). Lives in domain, not
// application, so both RotateRefreshTokenUseCase and RefreshSessionUseCase
// (application-layer, PR1/PR2) can depend on it without an application ->
// application import (backend.application.contracts forbids that; found
// during PR2 apply — see apply-progress).
export class RefreshTokenRotationLostRaceError extends Error {
  constructor() {
    super('Refresh token rotation lost the race — the presented token is no longer current');
    this.name = 'RefreshTokenRotationLostRaceError';
  }
}
