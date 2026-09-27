# Custom Commission Intake — ODD Feature Tasks

## Goal

Add an honest, local-demo custom commission request flow: any visitor can submit contact details and an idea; STAFF and ADMIN can inspect saved requests. Requests expire 30 days after submission and are physically purged by the local backend while running, with a purge on the next startup after downtime.

## Authorization and boundaries

- Authorized by the user on `feat/custom-commission-intake`; local work-unit commits are authorized, push is not.
- Baseline: `17deb23e43189424ee54f711551512d41c30816b` (`main-sync-17deb23`, synchronized with `origin/main`).
- Preserve all pre-existing untracked work. No staging of unrelated paths, no push, no PR, no deployment.
- Request fields: required name, email, idea; optional association to an existing product.
- STAFF and ADMIN may view requests. No status changes or delete UI are in scope.
- Do not add automated email, uploads, quotes, orders, payments, or production/cloud infrastructure.
- Be explicit that this is a local demo; submission is not an order, quote, payment, or promise of follow-up. No email is sent.
- Expiry is 30 days from creation. Expired records are excluded immediately; a local cleanup runs hourly while the backend is running and on startup. If the backend is stopped at expiry, physical deletion occurs on the next startup. The user accepted this local-demo limitation.
- Public intake must validate/bound input and rate-limit by IP. Backend authorization, not UI hiding, protects contact data.
- Follow `PRODUCT.md`, `DESIGN.md`, and `docs/diseno/manual-identidad.md`; use existing paper/ink tokens, accessible form patterns, and Rioplatense voseo.

## Tasks

### 1. Persist commission requests and implement retention — DONE

- [x] Add domain entity/port, Sequelize model/repository, migration, and typed model registration.
- [x] Add create/list/purge application behavior with injectable clock and tests.
- [x] Store `expiresAt = createdAt + 30 days`; optional product reference must not prevent deleting a catalog product (`SET NULL`).
- [x] Add hourly cleanup while the local backend runs and cleanup on next startup; expired requests must never appear in reads even if physical purge is delayed.
- [x] Keep database migration reversible and compatible with the repository migration runner.
- [x] Focused backend tests and type-check pass.
- **Verification:** serial focused Jest suite passed (8 suites / 28 tests); `pnpm --dir backend type-check` passed. RED/GREEN was recorded for the new behavior, except the simple entity field test was added after its source and is not counted as TDD evidence. LSP reported one AST rule warning for the extensionless import in `PurgeExpiredCommissionRequestsUseCase.ts`; extensionless relative imports are the established TypeScript convention here and type-check passed. The remaining 15 LSP file checks were inconclusive, not clean.
- **Work-unit slices:** split this 591-line task into three reviewable commits: `feat(commissions): add request schema and domain contract`; `feat(commissions): persist and expire commission requests`; `feat(commissions): schedule expired request cleanup`.
- **Commits:** `b712534` (`feat(commissions): add request schema and domain contract`), `f2511ad` (`feat(commissions): persist and expire commission requests`), `973b2f2` (`feat(commissions): schedule expired request cleanup`).

### 2. Expose public submission and STAFF/ADMIN read APIs — DONE

- [x] Add public POST with field validation and bounded IP rate limiting.
- [x] Add protected list API for ADMIN/STAFF only; no public read or mutation endpoint.
- [x] Document routes in the generated OpenAPI source and cover public, USER, STAFF, ADMIN, validation, rate-limit, and expiry behavior.
- [x] Focused backend route/security tests, type-check, and OpenAPI checks pass.
- [x] Independent follow-up fixed newest-first ordering, extracted schemas to keep `openapiSchemas.ts` at 220 lines, mapped the selected-product FK race to a safe 400, and removed request values from validation error responses.
- **Verification:** serial Jest 8 suites / 93 tests; backend type-check; OpenAPI drift check; `pnpm lint`; `pnpm frontend:quality-check`; `git diff --check` all passed. No migration or database-mutating command was run. LSP reported 22 AST warnings for extensionless relative imports (the established backend TypeScript convention); 3 files were inconclusive, not confirmed clean.
- **Commit:** `f0310a2` (`feat(commissions): expose public and staff request APIs`).

### 3. Build the visitor intake experience — DONE

#### Direction contract (`/help` extension)

THESIS: A visitor can leave an idea without this demo pretending it is a sale. OWN-WORLD: Inherit paper/ink, IBM Plex Sans, restrained borders, blue action, and quiet workshop spacing; no shadow or retro chrome. STORY: Explain what is collected, who can review it, how long it remains, and submit without an account. FIRST VIEWPORT: In the existing 800px content column, place a visible title and concise intro above a left-aligned vertical form; put the local-demo/retention disclosure before the primary submit action. FORM: One local extension of `/help`; no concept-seed or seed key because the world and scope are already fixed. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. The nonblocking Impeccable CLI lacks a surface-brief command, so this local-extension direction contract is recorded here; no new identity or seed was created.

- [x] Add the request service and form with optional product association, validation/loading/error/success states, and truthful local-demo disclosure.
- [x] Replace the home commission section's unsupported fulfillment promise; preserve its `/help` CTA and catalogue-first placement.
- [x] Update privacy and product documentation with collected data, purpose, STAFF/ADMIN visibility, 30-day expiry, deferred local purge, and no automated contact/transaction claims.
- [x] Focused frontend service tests, check/build, and frontend quality checks pass. The targeted form navigation check is tracked in Task 5.
- **Verification:** `pnpm --dir frontend exec vitest run src/domains/commissions/services/customCommissionRequest.service.test.ts` passed (6/6); `pnpm --dir frontend check` passed (97 files, 0 errors/warnings/hints); local `pnpm --dir frontend build` passed with the user's transient `PUBLIC_API_URL=http://localhost:3031` (18 pages); `pnpm --dir frontend quality:check` and `git diff --check` passed. No migration was applied. LSP limitation: Astro files have no configured language server; the service reports the established extensionless-relative-import AST warning. No browser/E2E navigation test is claimed as passed.
- **Commit:** `1223600` (`feat(commissions): add visitor intake form and disclosures`).

### 4. Add the STAFF/ADMIN request inbox — DONE

#### Direction contract (`/admin/commission-requests` local extension)

THESIS: Let authorized staff review real saved requests without implying fulfillment. OWN-WORLD: Extend the existing admin surface with paper/ink, IBM Plex Sans, restrained borders, and blue actions; no new identity or seed. STORY: Show the request details and optional catalog context while leaving the protected API response unchanged. FIRST VIEWPORT: Use the existing admin content layout for a clear inbox title, loading/error/empty states, and a readable newest-first request list. INTERACTION: Add no status or mutation controls; retain the existing `hasAdminAccess` page gate and `.admin-only` navigation visibility. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

- [x] Add `/admin/commission-requests` using the existing `hasAdminAccess` gate and admin visual conventions; unauthorized visitors do not request protected data.
- [x] Add an authenticated commission inbox service using `authFetch`; test success, 401, server, and network failures.
- [x] Add an `.admin-only` link in `HomeHeader.astro`.
- [x] Display API-ordered active requests with name, email, idea, created date, and optional product name. Resolve names through `fetchProducts()` by `idProduct`; use `Producto #<id>` when unresolved and indicate no association for null IDs. Catalog delay/failure does not block the request list.
- [x] Keep the backend API unchanged; add accessible loading, empty, error, and retry states, safe text rendering, and no mutation controls.
- [x] Focused service tests and Astro check pass; independent verification confirmed role gate, 401 behavior, catalog fallback, and no mutations.
- **Verification:** `pnpm --dir frontend exec vitest run src/domains/commissions/services/customCommissionRequest.admin.service.test.ts` passed (3/3); `pnpm --dir frontend check` passed (100 files, 0 errors/warnings/hints). Independent verifier confirmed service and UI behavior. Task 5 browser E2E remains pending; no migration was run.
- **Commit:** pending.

### 5. Verify the end-to-end local demo flow — IN PROGRESS

- [ ] Add an E2E scenario that follows the existing home CTA from `/` to `/help` before public submission, then verifies STAFF/ADMIN visibility and denial for anonymous/USER reads, without making external calls.
- [ ] Run focused backend/frontend tests, relevant type-checks/OpenAPI checks, and the targeted Playwright scenario; run broader checks when practical.
- [ ] Inspect final diff and preserve unrelated pre-existing untracked paths.
- **Commit:** pending.

## Progress log

- 2026-09-27: Started on `feat/custom-commission-intake`. Feature task artifacts were established before the first source change.
- 2026-09-27: Product choices confirmed: public name/email + idea, optional product association, STAFF/ADMIN viewing, no email/attachments/quotes/orders/payments, 30-day expiry with deferred local purge if the backend is offline.
- 2026-09-27: Task 1 implementation and independent verification passed; no database migration was applied.
- 2026-09-27: Task 1 closed in three work-unit commits: `b712534`, `f2511ad`, `973b2f2`. The local pre-commit hook was repaired in this repository only and its lint/quality checks pass.
- 2026-09-27: Task 2 API implementation and independent verification passed; commit `f0310a2` adds public submission and protected STAFF/ADMIN listing. No database migration was applied. Task 3 is now in progress.
- 2026-09-27: Task 3 closed in commit `1223600` (`feat(commissions): add visitor intake form and disclosures`). Browser navigation E2E from the home CTA to `/help` remains in Task 5. Native RDD scoping blocker: inspect binds the accumulated feature from `17deb23`; an explicit unit base was rejected as `candidate-target-projection-drift`. No lineage was created; do not start a review on the accumulated branch. Task 4 implementation and focused verification are complete; Task 5 is in progress.
