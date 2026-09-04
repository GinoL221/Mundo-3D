// The reap cutoff, decoupled from the 30s grace window (proposal decision 1).
// Env-tunable: this is the no-deploy incident lever for the accepted
// false-positive risk, mirroring ACCESS_TOKEN_TTL_SECONDS (predecessor D4).
export const REFRESH_TOKEN_REAP_SECONDS = Number(process.env.REFRESH_TOKEN_REAP_SECONDS) || 24 * 60 * 60;
