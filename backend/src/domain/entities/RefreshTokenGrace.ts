// design.md D2/D7's 30s grace window, shared by RotateRefreshTokenUseCase
// (reap cutoff) and RefreshSessionUseCase (grace-hit detection) — both
// application-layer. Lives in domain so neither imports the other's module
// directly (backend.application.contracts forbids application -> application
// imports; found during PR2 apply — see apply-progress).
export const REFRESH_TOKEN_GRACE_SECONDS = 30;
