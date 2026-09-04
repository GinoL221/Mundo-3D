// The 30s grace window: how long a just-superseded token still authenticates,
// which is what keeps two of a user's own tabs from reading as a replay. Read
// by RefreshSessionUseCase to separate a grace hit (row 5) from reuse (row 6).
//
// This is a protocol constant — the spec states it — and deliberately NOT the
// reap cutoff any more. Retention is an operational knob living in
// infrastructure (REFRESH_TOKEN_REAP_SECONDS); welding both to this one value
// is what let every rotation delete the evidence reuse detection needs.
//
// Lives in domain because application files may not import each other
// (backend.application.contracts), so a shared application-layer home was
// never available.
export const REFRESH_TOKEN_GRACE_SECONDS = 30;
