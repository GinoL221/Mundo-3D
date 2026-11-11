# Logout refresh-token revocation

Add an explicit session-revocation endpoint so a client can revoke its refresh-token family even when no access-token cookie is present. Worktree `logout-revocation`, branch `test/logout-revocation-gap`.

## Specs

S1. Confirmed defect, evidenced by a RED test: `UserApiController.logout` reads only `req.cookies?.[AUTH_COOKIE]`; when that cookie is absent, `familyId` is `undefined`, `revokeRefreshTokenUseCase` is never called, the response is still `204`, and a subsequent refresh with the same refresh token returns `200`. The intended behaviour of the counterpart case is pinned in the same test: with the access cookie present, logout revokes and the refresh returns `401`.

S2. Approved design (option B, chosen by the user over widening the cookie `Path`): "Ruta de revocación dentro del scope actual, por ejemplo `POST /api/users/refresh/revoke`. La cookie llega sin ampliar nada, el cliente la llama en el logout, y funciona justamente cuando no hay token de acceso. Agrega un endpoint que recibe una credencial ambiente, así que necesita la misma protección CSRF que ya tiene el refresh."

S3. The refresh cookie `Path` must not be widened, and `HttpOnly`, `Secure`, and `SameSite` attributes must not be relaxed to make revocation reachable.

S4. The endpoint must not become an oracle: it answers the same status whether or not the presented refresh token exists, is already revoked, or belongs to an unknown family, and it must not disclose token or family existence in the response body.

S5. The existing `logout` tolerance stays: logout must keep succeeding with an absent, expired, or invalid access cookie. This change adds a revocation path; it does not make logout fail.

S6. A genuine revocation failure (repository error) must not be reported as success by the new endpoint.

S7. Documentation of the auth/session behaviour is updated where the existing docs describe logout and refresh.

## Tasks

| ID | Spec | Route | Commit |
| --- | --- | --- | --- |
| T1 | S1-S6 | worker: route, controller handler, CSRF parity, tests RED->GREEN | completed |
| T2 | S7 | worker: docs update | completed |
| T3 | S1-S6 | verify: independent verification of the closed gap | pending |
| T4 | all | parent: native review, high risk (security) | pending |

## Log

L1: "si" — user authorizes option B.

L2: Accepted design and its rationale, as proposed and accepted: "No amplía la exposición de la cookie, hace explícita la intención y cubre exactamente el caso que falla. Es chico de implementar, pero toca autenticación: cuenta como riesgo alto y va con revisión nativa y su propio PR, no dentro del #205."

L3: Evidence of the defect, from the RED run in this worktree: `expect(gapRefreshRes.status).toBe(401)` failed with `Expected: 401, Received: 200` at `backend/src/infrastructure/controllers/__tests__/UserApiController.session-revocation.test.ts:231`. The test mounts the real controller with real use cases; it does not exercise browser cookie path rules or MySQL row locking.

L4: Existing test file stays as the regression anchor for T1: it must go from RED to GREEN without weakening either assertion.

L5: Independent verification verdict (read-only, nothing edited). S1 pass for the endpoint but unproven end to end; S2 pass with misleading comments at `users.ts:338-340` and `:346-347`; S3 pass (cookie attributes untouched); S4 pass for status, body and headers, with a low-severity timing distinction between unknown (one SELECT) and valid/revoked (SELECT plus UPDATE); privilege pass (family comes only from the presented hash, families are single-user); S5 pass; S6 pass but narrow. Three corrections required before review. (a) The anchor test title at `session-revocation.test.ts:170` still claims "logout without an access-token cookie must revoke", but `:226-229` now calls `/refresh/revoke` before the cookieless logout, so the test proves the endpoint closes the gap, not that logout does. Split it honestly. (b) `frontend/src/lib/http/authFetch.ts:25` is a second logout path that still calls only `/api/users/logout`, on any failed refresh including 429, 5xx and network errors, so the original defect survives there. (c) `refreshLimiter` has `skipSuccessfulRequests: true` and the endpoint always answers 204, so the new route is effectively unthrottled; the S4 test also checks status and body but not headers. Timing leak accepted as documented hardening because the caller must already hold the plaintext token.

L6: Bounded correction round completed.
- Anchor test split: Truthful anchor test proving `/api/users/refresh/revoke` invalidates the family when no access cookie is present (and preserving counterpart assertion with access cookie present), plus a second test pinning the documented tolerance that cookieless logout alone does NOT revoke the family (refresh returns 200). Mutation verified by removing revoke call in the split anchor test, which produced Expected: 401, Received: 200.
- Second frontend logout path: `authFetch.ts` updated to call both `/api/users/logout` and `/api/users/refresh/revoke` with `credentials: 'include'` and `keepalive: true`. Sharing a single cross-domain helper between `authFetch.ts` and `session.service.ts` would require modifying `frontend/src/config.ts` due to `frontend.domain.locality`, which is outside allowed edit surfaces; reported accordingly.
- Dedicated limiter: Added `revokeRefreshLimiter` middleware with `skipSuccessfulRequests: false` so every revoke request consumes budget. Proved with focused rate-limiting test under Jest. Removing `JEST_WORKER_ID` bypass caused 0 regressions across all 207 backend suites.
- Comments corrected: `users.ts:338-340` and `:346-347` updated to state that `SameSite=lax` is the real CSRF defense and that `revokeRefreshLimiter` counts every request.
- Documentation: Created `docs/session-cookie-contract.md` describing session cookies, CSRF defenses, both endpoints, the two-request client protocol, and explicit cookieless logout tolerance.

L7: Final bounded correction round completed.
- E2E rate-limiter override: Added `REVOKE_REFRESH_LIMIT_MAX: '1000'` in `e2e/playwright.config.ts` to prevent E2E suites from hitting 429 on the new route.
- Revocation rate limit & comment correction: Raised default ceiling in `revokeRefreshLimiter.ts` to 100 requests per 15 minutes per IP to avoid accidental exhaustion for users on shared NATs while keeping DB lookup throttled. Updated comment at `users.ts:346-350` to acknowledge that both `/users/logout` and `/users/refresh/revoke` touch the database, removing the false asymmetry.
- OpenAPI documentation: Added OpenAPI block for `POST /users/refresh/revoke` in `users.ts` documenting 204 and 429 responses.
- Spec reconciliation: Updated `openspec/specs/session-cookie-security/spec.md` to narrow path scoping to the `/api/users/refresh` prefix (encompassing the revocation sub-path) and `openspec/specs/api-jwt-auth/spec.md` to specify that logout revokes when `familyId` can be identified from the access cookie, with cookieless revocation performed via the dedicated endpoint.
- Doc overclaims: Corrected statements in `docs/session-cookie-contract.md` regarding CSRF defense scope, best-effort revocation, and independent call site implementations.
- Test gaps: Asserted response header invariants in S4 no-oracle test (`session-revocation.test.ts`), and pinned `method: 'POST'`, `headers: undefined`, and `body: undefined` in `authFetch.test.ts` and `session.service.test.ts` to ensure keepalive compatibility.
- Edit surface boundary: `backend/src/infrastructure/openapi/__tests__/openapiSpec.test.ts` and `backend/openapi.json` were not in the parent's allowed edit surfaces, so the OpenAPI contract test and drift check fail as reported.

L8: Final round (L7) plus the parent completing what sat outside the worker's surfaces. E2E gets `REVOKE_REFRESH_LIMIT_MAX=1000`; the production default is 100 per 15 minutes per IP with the NAT reasoning in the comment; the route has its OpenAPI block and `EXPECTED_ENDPOINTS` plus the regenerated `backend/openapi.json` now cover `POST /users/refresh/revoke`; both specs are amended in place with the before/after quoted in the worker report; the doc's three overclaims are corrected; the oracle test asserts response headers and both frontend call sites pin method, absent headers and absent body. The repository has no active `openspec/changes/` directory, so the specs were amended directly and no change record was invented. Verification after these edits: `check:openapi` exit 0, backend fast 207 suites / 1519 tests, frontend 30 files / 319 tests, architecture, type-check and lint all exit 0. Open follow-up: `openspec/specs` still has no dedicated requirement for `POST /users/refresh/revoke`; it is referenced from the logout requirement and documented in `docs/session-cookie-contract.md`.

L9: Delivery slice recorded. The whole feature lands in one commit, `b4a1fc0`, with 788 authored changed lines, above the ~400-line review guide. It stays a single slice on purpose: the endpoint, both client call sites, the two spec amendments and the tests assert one contract, and shipping the route without the client call would leave the defect reachable while the specs would contradict the code. No further commits are planned on this branch before review.
