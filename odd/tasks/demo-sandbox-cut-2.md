# Demo Sandbox Cut 2

Buyer-only HTTP API under `/api/demo/*` behind `DEMO_SANDBOX_ENABLED=false` plus cross-slot and main-DB isolation verification.
Delivered as 4 sequential PRs to `main` (`<= 400` authored lines each) under active RDD.

## Specs

- S1: "Tienda + encargos a medida (Recomendado)" — Expose Buyer-only `/api/demo/*` surface: session lifecycle (`/api/demo/session`, `/api/demo/session/refresh`), read-only catalog (`/api/demo/products`, `/api/demo/products/:id`, `/api/demo/categories`, `/api/demo/franchises`), cart (`/api/demo/cart`), orders (`/api/demo/orders`, `/api/demo/orders/:id`), and custom commission intake (`POST /api/demo/custom-commission-requests`, `NoopMailAdapter`, no real email or external uploads). Never expose `Role.STAFF`, `Role.ADMIN`, `/register`, `/login`, or admin routes on `/api/demo/*`.
- S2: "15m idle / 45m max, 404 si apagado (Recomendado)" — Lease TTL is 15 minutes idle (`900_000` ms) and 45 minutes max lifetime (`2_700_000` ms). When `DEMO_SANDBOX_ENABLED=false`, `/api/demo/*` fails closed with `404` without opening slot DB pools. When enabled and all slots are busy, `POST /api/demo/session` returns `503` (`DEMO_SANDBOX_BUSY`).
- S3: "Solo salir (DELETE /api/demo/session) (Recomendado)" — `DELETE /api/demo/session` (CSRF-protected) revokes the slot refresh token if present, transitions the slot `'leased' -> 'draining'`, clears demo cookies, and lets the reset path reclaim the slot; no in-place `POST /api/demo/session/reset` endpoint.
- S4: Strict credential, cookie, and DB isolation — Dedicated sandbox cookies (`m3d_demo_auth` `HttpOnly` `Path=/api/demo`, `m3d_demo_refresh` `HttpOnly` `Path=/api/demo/session/refresh`, `m3d_demo_csrf` HMAC-bound to `slotId + leaseId + userId`) signed with `DEMO_SANDBOX_JWT_SECRET` (`>= 32` chars, distinct from `JWT_SECRET`). Production tokens must fail on `/api/demo/*`, sandbox tokens must fail on `/api/*`, cross-slot CSRF must fail, and no `/api/demo/*` handler may read or mutate the main DB.
- S5: Automated verification — Unit tests, HTTP/Supertest contract tests, OpenAPI & architecture checks (`check:openapi`, `architecture:check`), and real disposable MySQL 8.0 cross-slot & main-DB isolation tests (requesting explicit authorization before starting any local MySQL container).

## Tasks

- T2A S2,S3,S4 — PR 2A (#288 MERGED, Closes #287): `DemoSandboxSlot.release` + `releaseLease` repo/use-case, `tokenHasher` fix in `DemoSandboxAuthUseCases`, `DEMO_SANDBOX_JWT_SECRET >= 32` check in `DemoSandboxConnections` & `env-preflight`, dedicated sandbox cookie & scoped CSRF helpers + unit tests — inline — commit: d448853 (verified, RDD review-9a5c9660f49e4b66 burned)
- T2B-1 S2,S4 — PR 2B-1 (Refs #289): PR #288 advisory follow-ups (`typeof` CSRF scope guards, null-row `releaseLease` test, 32-char/trimmed secret boundary tests), active sandbox runtime accessor in `demoSandboxRuntime.ts`, Buyer session auth/JWT/CSRF middlewares (`demoSandboxSession.ts`) + unit tests — worker — commit: pending
- T2B-2 S1,S2,S3,S4 — PR 2B-2 (Closes #289): `DemoSandboxSessionController` (`/api/demo/session` `POST`/`GET`/`DELETE`, `POST /api/demo/session/refresh`, slot-release-on-error, `familyId` family revocation), per-IP rate limiters (`routes/api/demo.ts`), router mount & architecture allowlist + Supertest suite — worker — commit: pending
- T2C S1,S4,S5 — PR 2C: Mount Buyer-only `/api/demo/{products,categories,franchises,cart,orders,custom-commission-requests}` wired exclusively to `DemoSandboxProductRepositories` + `NoopMailAdapter`, architecture `compositionRoots` & OpenAPI annotations + tests — inline — commit: pending
- T2D S4,S5 — PR 2D: Cross-slot, main-DB, cross-token, cross-CSRF, role-rejection, and post-exit isolation integration tests against disposable MySQL 8.0 — inline — commit: pending

## Log

- L1: User requested starting Cut 2 exploration and design after merging Cut 1 (`main@fa9e977`, 0 open issues/PRs).
- L2: User confirmed Cut 2 product contract via questionnaire: (1) Buyer surface = "Tienda + encargos a medida (Recomendado)"; (2) Lease & flag = "15m idle / 45m max, 404 si apagado (Recomendado)"; (3) Exit/reset = "Solo salir (DELETE /api/demo/session) (Recomendado)"; (4) Next step = "Aprobar diseño y arrancar Corte 2 (ODD + PRs)".
