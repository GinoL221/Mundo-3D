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

### 2. Expose public submission and STAFF/ADMIN read APIs — READY TO COMMIT

- [x] Add public POST with field validation and bounded IP rate limiting.
- [x] Add protected list API for ADMIN/STAFF only; no public read or mutation endpoint.
- [x] Document routes in the generated OpenAPI source and cover public, USER, STAFF, ADMIN, validation, rate-limit, and expiry behavior.
- [x] Focused backend route/security tests, type-check, and OpenAPI checks pass.
- [x] Independent follow-up fixed newest-first ordering, extracted schemas to keep `openapiSchemas.ts` at 220 lines, mapped the selected-product FK race to a safe 400, and removed request values from validation error responses.
- **Verification:** serial Jest 8 suites / 93 tests; backend type-check; OpenAPI drift check; `pnpm lint`; `pnpm frontend:quality-check`; `git diff --check` all passed. No migration or database-mutating command was run. LSP reported 22 AST warnings for extensionless relative imports (the established backend TypeScript convention); 3 files were inconclusive, not confirmed clean.
- **Commit:** pending local work-unit commit.

### 3. Build the visitor intake experience

- [ ] Extend the existing help route with the request form, optional product association, validation/loading/error/success states, and truthful local-demo disclosure.
- [ ] Make the home commission CTA lead to this request form; retain the catalogue-first hierarchy.
- [ ] Update privacy and product documentation with the collected data, purpose, STAFF/ADMIN visibility, 30-day expiry, deferred local purge behavior, and no automated contact/transaction claims.
- [ ] Focused frontend tests and frontend check/build pass.
- **Commit:** pending.

### 4. Add the STAFF/ADMIN request inbox

- [ ] Add a responsive admin inbox using the existing admin visual and session conventions.
- [ ] Display newest unexpired requests, contact and idea details, and optional product context; include loading/error/empty states.
- [ ] Expose navigation only to STAFF/ADMIN while enforcing roles at the API.
- [ ] Cover role visibility and inbox service/state behavior with tests; frontend check/build pass.
- **Commit:** pending.

### 5. Verify the end-to-end local demo flow

- [ ] Add an E2E scenario for public submission, STAFF/ADMIN visibility, and denial for anonymous/USER reads, without making external calls.
- [ ] Run focused backend/frontend tests, relevant type-checks/OpenAPI checks, and the targeted Playwright scenario; run broader checks when practical.
- [ ] Inspect final diff and preserve unrelated pre-existing untracked paths.
- **Commit:** pending.

## Progress log

- 2026-09-27: Started on `feat/custom-commission-intake`. Feature task artifacts were established before the first source change.
- 2026-09-27: Product choices confirmed: public name/email + idea, optional product association, STAFF/ADMIN viewing, no email/attachments/quotes/orders/payments, 30-day expiry with deferred local purge if the backend is offline.
- 2026-09-27: Task 1 implementation and independent verification passed; no database migration was applied.
- 2026-09-27: Task 1 closed in three work-unit commits: `b712534`, `f2511ad`, `973b2f2`. The local pre-commit hook was repaired in this repository only and its lint/quality checks pass; task 2 is now in progress.
