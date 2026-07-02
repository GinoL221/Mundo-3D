# Delta for CSRF Error Pages

## REMOVED Requirements

### Requirement: CSRF 403 Error Rendering

(Reason: Confirmed orphaned. `backend/src` contains no CSRF middleware implementation (only an unrelated `csrf`-named field in `types/express.d.ts` was found, not a middleware), and the codebase has zero `.ejs` files — the EJS view layer this requirement depends on (`403Forbidden.ejs`, `head.ejs`, `.error-page` BEM styling) does not exist. The application is JSON+Bearer only; there is no CSRF token flow to protect.)
(Migration: None. Superseded by "Route Capability Matrix" in the admin-route-guard delta, which covers 401/403 JSON responses for guarded API routes.)

### Requirement: 403 Error View Template

(Reason: Same as above — no `403Forbidden.ejs` view exists, and no EJS rendering pipeline exists in the current codebase to render it.)
(Migration: None. Guarded routes return JSON error bodies, not rendered views.)
