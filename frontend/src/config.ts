// Pure downward re-export facade (design.md D6, task 3.8). The real
// implementations moved to `frontend/src/lib/http/*` — `layer()` in
// `backend/tools/architecture/engine.js` treats `frontend/src/lib/**` as
// unconstrained, so that tree can freely house cross-domain HTTP helpers
// without the `frontend.domain.locality` rule applying. `config.ts` stays
// the one import specifier every `domains/**` file is allowed to reach
// outside its own folder, so no existing `../../../config` import needs to
// change.
export { API_URL } from './lib/http/apiBase';
export {
  getSessionUser,
  readApiErrorMessage,
  readCsrfToken,
  withCredentials,
} from './lib/http/credentials';
export type { APIErrorBody, APIFieldError, SessionUser } from './lib/http/credentials';
export { authFetch } from './lib/http/authFetch';
export { ensureRefreshed } from './lib/http/refreshSingleFlight';
