import { RememberToken } from '../entities/RememberToken';

// Lets RefreshSessionUseCase depend on rotation without importing
// RotateRefreshTokenUseCase directly — backend.application.contracts
// forbids an application-layer file from importing another application-layer
// file (only domain contracts are allowed targets). RotateRefreshTokenUseCase
// implements this port structurally (found during PR2 apply).
export interface RefreshTokenRotatorPort {
  execute(current: RememberToken, newPlainToken: string): Promise<RememberToken>;
}
