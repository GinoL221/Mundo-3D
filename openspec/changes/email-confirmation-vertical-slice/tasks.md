# Email Confirmation Vertical Slice — Implementation Tasks

Deliver a locally demonstrable, provider-agnostic email-confirmation flow while preserving current registration, cookie-session, login, cart, account, checkout, and role behavior. Do not claim production delivery or introduce a queue, outbox, worker, microservice, or verification access gate.

## Review Workload Forecast

| Field                   | Value                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | 2,000–3,000 across ~55 production, test, config, and E2E files                                                              |
| 400-line budget risk    | High                                                                                                                        |
| Chained PRs recommended | Yes                                                                                                                         |
| Suggested split         | PR 1 persistence/security → PR 2 token issue/confirm/registration → PR 3 resend/SMTP/API → PR 4 frontend/E2E/final evidence |
| Delivery strategy       | ask-on-risk (resolved: four reviewable chained slices)                                                                      |
| Chain strategy          | stacked-to-main                                                                                                             |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

> **Resolved apply constraints:** Limited resend requests, including rate-limited cases, return the same generic HTTP `202`; links use deployment-owned `PUBLIC_APP_URL`; deliver the four slices as a `stacked-to-main` chain. Apply MUST preserve the 400-line changed-lines review budget in each slice—split a slice further by autonomous behavior if its honest diff approaches the budget; do not use a single oversized PR or `size:exception`.

## Delivery boundaries and dependencies

| Unit                          | Depends on | Finish boundary                                                 | Rollback boundary                                                                                |
| ----------------------------- | ---------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1. Persistence foundation     | —          | Migration/model contract is real-DB proven                      | Revert model/repository contracts; run migration down only after readers are absent              |
| 2. Security and domain seams  | 1          | Deterministic, provider-neutral primitives exist                | Revert isolated entities, ports, and adapters                                                    |
| 3. Token replacement          | 1–2        | One active digest-only token is transactionally maintained      | Revert issuer/repository together; preserve database history until controlled migration rollback |
| 4. Confirmation               | 1–3        | POST-only atomic/idempotent confirmation is proven              | Remove route composition before reverting use case/repository                                    |
| 5. Registration compatibility | 1–3        | Registration stays byte-compatible despite post-commit issuance | Revert registration wiring without altering existing session/controller paths                    |
| 6. Resend and limits          | 1–3        | Private resend and local limits always return generic `202`     | Remove resend route/limiter wiring; retain safely committed tokens                               |
| 7. SMTP and local demo        | 2–3        | Mailpit-compatible adapter accepts post-commit intents          | Disable adapter/config wiring; do not roll back users/tokens for mail outage                     |
| 8. Frontend                   | 4, 6       | Neutral GET and explicit POST/resend UI works                   | Remove page/components/styles independently from backend state                                   |
| 9. E2E and final gates        | 1–8        | Local demonstration and regressions are evidenced               | Keep prior unit/integration evidence; revert each behavior unit in reverse dependency order      |

## Stacked delivery sequence

| Slice                                                      | Units | Base   | Review boundary                                                                                           |
| ---------------------------------------------------------- | ----- | ------ | --------------------------------------------------------------------------------------------------------- |
| PR 1 — persistence/security                                | 1–2   | `main` | Migration, internal model, crypto, ports, and `PUBLIC_APP_URL` configuration validation with their tests. |
| PR 2 — token issue/confirmation/registration compatibility | 3–5   | PR 1   | Transactional issuance/confirmation and unchanged registration/session behavior with their tests.         |
| PR 3 — resend/SMTP/API                                     | 6–7   | PR 2   | Generic-`202` resend limits, SMTP/Mailpit composition, routes, and OpenAPI with their tests.              |
| PR 4 — frontend/E2E/final evidence                         | 8–9   | PR 3   | Neutral frontend flow, local E2E demonstration, regression evidence, and final gates.                     |

Each slice MUST remain at or below 400 changed lines (additions plus deletions). If a proposed slice honestly exceeds that budget, apply MUST create a dependency-safe additional stacked slice rather than compressing tests/docs or requesting `size:exception`.

## 1. Migration and model foundation

**Repository surfaces:** `backend/src/database/migrations/<timestamp>-email-confirmation.js`, `backend/src/database/models/User.js`, `backend/src/database/models/EmailConfirmationToken.js`, `backend/src/database/models/index.js`, `backend/src/database/models/db.d.ts`, `backend/src/domain/entities/User.ts`, `backend/src/domain/entities/EmailConfirmationToken.ts`, and colocated migration/model/integration tests under `backend/src/database/{migrations,models}/__tests__/`.

- [x] **RED — add real-MySQL migration tests** for captured-timestamp backfill of pre-existing users, null default for post-migration users, digest-only token fields, FK/indexes including one `(id_user, active_slot=1)` authority, and dependency-safe down behavior. Run `pnpm --filter backend test:integration -- --runInBand backend/src/database`. <!-- sdd-owner: implementation -->
- [x] **GREEN — implement the additive migration and Sequelize mappings**: add nullable `User.emailVerifiedAt`/`email_verified_at`, create the digest-only token table with expiry/consumed/invalidated/active-slot timestamps and indexes, register association/types, and implement down as token table first then user column; record statement-attributed migration errors because MySQL DDL auto-commits. Run the focused real-DB migration command. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE — extend persistence cases** for multiple historical null active slots, duplicate active-slot rejection, cascade behavior, and down safety without changing existing user/session/login/checkout rows. Run `pnpm --filter backend test:integration -- --runInBand backend/src/database` and `pnpm --filter backend test -- --runInBand backend/src/database`. <!-- sdd-owner: implementation -->
- [x] **REFACTOR — keep migration/model files below 250 source lines** and make entity mapping internal-only; confirm no public DTO gains `emailVerifiedAt`. Run `pnpm --filter backend test -- --runInBand backend/src/database backend/src/application/__tests__/DomainEntities.test.ts`. <!-- sdd-owner: implementation -->

## 2. Domain and security primitives

**Depends on:** 1. **Repository surfaces:** `backend/src/domain/entities/NormalizedEmail.ts`, `backend/src/domain/ports/{EmailConfirmationTokenRepositoryPort,MailPort,ConfirmationTokenGeneratorPort,PublicOriginPort,ClockPort,EmailConfirmationIssuerPort,EmailConfirmationRateLimitPort}.ts`, `backend/src/domain/exceptions/InvalidEmailConfirmationToken.ts`, `backend/src/infrastructure/security/{CryptoConfirmationTokenGenerator,Sha256TokenHasher}.ts`, `backend/src/infrastructure/config/emailConfirmationConfig.ts`, plus colocated tests.

- [x] **RED — write unit tests** for trim/lowercase normalization, 32-byte CSPRNG base64url token output, SHA-256 lowercase-hex digest, a clock-controlled exact 24-hour expiry, approved non-secret record-id idempotency keys, trusted-origin URL acceptance/rejection, and unchanged DTO serialization. Tests exercise the deployment-owned `PUBLIC_APP_URL` parser through the origin port. Run `pnpm --filter backend test -- --runInBand backend/src/domain backend/src/infrastructure/security backend/src/infrastructure/config`. <!-- sdd-owner: implementation -->
- [x] **GREEN — add domain entities, exceptions, and ports plus crypto/config adapters** with no infrastructure imports from domain; origin validation rejects credentials/query/fragment/non-root paths and requires HTTPS outside localhost demo. Run the focused backend command. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE — test adversarial inputs**: malformed origins, encoded tokens, different clock values, token collision retry behavior if supported by repository contract, and proof that token/email/URL material is absent from observable DTOs and idempotency keys. Run the focused backend command and `pnpm --filter backend test -- --runInBand backend/src/architecture`. <!-- sdd-owner: implementation -->
- [x] **REFACTOR — split contracts/adapters by responsibility** and update architecture-boundary tests if new allowed ports require explicit recognition. Run `pnpm --filter backend test -- --runInBand backend/src/architecture backend/src/domain backend/src/infrastructure/security`. <!-- sdd-owner: implementation -->

## 3. Atomic token replacement and issuance

**Depends on:** 1–2. **Repository surfaces:** `backend/src/infrastructure/repositories/{SequelizeEmailConfirmationTokenRepository,SequelizeUserRepository}.ts`, `backend/src/application/use-cases/IssueEmailConfirmationUseCase.ts`, `backend/src/infrastructure/persistence/SequelizeUnitOfWork.ts` (only if its opaque transaction contract needs extension), and their unit/real-DB integration tests.

- [ ] **RED — add repository/use-case tests** for lock-user-first replacement, invalidate-and-insert as one transaction, no mail before token commit, no token/mail on persistence failure, one active token under concurrent replacements, and post-commit mail failure retaining the usable token. Run `pnpm --filter backend test:integration -- --runInBand backend/src/infrastructure/repositories` plus focused application tests. <!-- sdd-owner: implementation -->
- [ ] **GREEN — implement transaction-aware repository operations and issuer orchestration** so plaintext remains only in memory through URL/mail submission, verified users are ineligible, and mail failures become sanitized outcomes rather than rollback triggers. Run the same focused commands. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE — add real-MySQL race and rollback cases** for concurrent resends/replacements, unique-index backstop, committed-token/no-mail failure, and sanitized logger arguments containing neither email nor plaintext/digest/URL. Run `pnpm --filter backend test:integration -- --runInBand backend/src/infrastructure/repositories`. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR — preserve opaque transaction and port seams** without use-case-to-use-case imports; keep test fakes alongside the behavior they verify. Run `pnpm --filter backend test -- --runInBand backend/src/application backend/src/architecture`. <!-- sdd-owner: implementation -->

## 4. Atomic POST confirmation

**Depends on:** 1–3. **Repository surfaces:** `backend/src/application/use-cases/ConfirmEmailUseCase.ts`, `backend/src/infrastructure/controllers/EmailConfirmationApiController.ts`, `backend/src/infrastructure/middlewares/{confirmationAttemptLimiter.ts,validators/emailConfirmationValidators.ts}`, `backend/src/infrastructure/routes/api/users.ts`, relevant repository files, and colocated application/controller/route/integration tests.

- [ ] **RED — write tests first** for bounded POST-body token validation, generic-equivalent `400` for missing/malformed/unknown/expired/superseded inputs, valid and consumed+verified `204`, transaction rollback on partial failure, concurrent confirmation one-winner behavior, and resend/confirm locking races. Run focused backend application/controller/route tests and `pnpm --filter backend test:integration -- --runInBand backend/src/infrastructure/repositories`. <!-- sdd-owner: implementation -->
- [ ] **GREEN — implement hash-before-lookup, lock-user-first atomic verify-and-consume, generic exception mapping, unauthenticated JSON route, and 30/IP/15-minute attempt limiter before validation**; do not alter cookies or session code. Run the focused commands. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE — prove privacy and method semantics** with route tests comparing observable invalid responses, asserting `GET /confirm-email` is not an API mutation path, and inspecting logs/bodies for forbidden secrets. Run `pnpm --filter backend test -- --runInBand backend/src/infrastructure/controllers backend/src/infrastructure/routes/api backend/src/infrastructure/middlewares`. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR — isolate validation, limiter, controller mapping, and repository state logic** into sub-250-line files while retaining a single generic external invalid contract. Run focused backend tests and `pnpm --filter backend test -- --runInBand backend/src/architecture`. <!-- sdd-owner: implementation -->

## 5. Registration compatibility with post-commit issuance

**Depends on:** 1–3. **Repository surfaces:** `backend/src/application/use-cases/RegisterUserUseCase.ts`, `backend/src/infrastructure/controllers/UserApiController.ts`, `backend/src/infrastructure/routes/api/users.ts`, `backend/src/application/dtos/UserDTO.ts` (regression surface only), existing registration/session/upload tests, and `frontend/src/domains/auth/**` registration tests only where redirect behavior is currently covered.

- [ ] **RED — pin existing behavior with regression tests**: required multipart image, current `201` body byte/shape compatibility, immediate auth cookies, frontend redirect, duplicate-registration race and losing-upload cleanup, null internal verification state, and unverified login/cart/account/checkout/role access. Add token-persistence and SMTP-failure cases proving registration/session success remains committed and user-creation failure causes neither token nor mail. Run focused backend user/controller/route tests plus existing frontend auth and checkout tests. <!-- sdd-owner: implementation -->
- [ ] **GREEN — inject the issuer through `EmailConfirmationIssuerPort` after successful user creation** and sanitize/catch issuance failures without changing `UserDTO`, controller session establishment, upload order, status, body, or redirect behavior. Run the focused regressions. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE — exercise call ordering and failure boundaries** across successful registration, duplicate/user-create failure, token persistence failure, and SMTP failure; assert no plaintext enters logs, responses, or persisted user fields. Run `pnpm --filter backend test -- --runInBand backend/src/application/__tests__/RegisterUserUseCase.test.ts backend/src/infrastructure/controllers/__tests__/UserApiController.test.ts backend/src/infrastructure/routes/api/__tests__/users.test.ts`. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR — retain current registration middleware ordering and session ownership**; remove duplication in test fixtures without weakening multipart/cookie assertions. Run `pnpm --filter backend test -- --runInBand backend/src/application backend/src/infrastructure/controllers backend/src/infrastructure/routes/api`. <!-- sdd-owner: implementation -->

## 6. Resend privacy and local rate limits

**Depends on:** 1–3; the binding limited-resend contract is generic HTTP `202`. **Repository surfaces:** `backend/src/application/use-cases/ResendEmailConfirmationUseCase.ts`, `backend/src/infrastructure/rate-limit/emailConfirmationAccountLimiter.ts`, `backend/src/infrastructure/middlewares/resendConfirmationIpLimiter.ts`, `backend/src/infrastructure/middlewares/validators/emailConfirmationValidators.ts`, `backend/src/infrastructure/controllers/EmailConfirmationApiController.ts`, `backend/src/infrastructure/routes/api/users.ts`, and colocated unit/route tests.

- [ ] **RED — add fake-clock and route tests** for normalized absent/verified/eligible requests and rate-limited requests sharing the same generic `202`, no token/send for absent or verified users, replacement for eligible users, five accepted requests/IP/hour, three actual account sends/hour, 60-second interval, reservation release before SMTP invocation, retention after SMTP attempt, and non-disclosing limit behavior. Run focused resend/limiter/controller/route tests. <!-- sdd-owner: implementation -->
- [ ] **GREEN — implement the normalized lookup, in-process reservation store, accepted-request IP limiter after syntax validation, account-limit sequencing, and generic-`202` limited-response mapping**; use trusted `req.ip` only and never query account state in middleware. Run the focused tests. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE — test limiter boundaries and concurrency** at exactly 5/6 IP requests, 3/4 sends, 59/60 seconds, rolling-hour expiry, verified-during-issuance release, and mail rejection after invocation; compare absent/verified/eligible response bodies. Run `pnpm --filter backend test -- --runInBand backend/src/application backend/src/infrastructure/middlewares backend/src/infrastructure/routes/api`. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR — document the single-process limitation in configuration/OpenAPI text without implying distributed enforcement** and keep limiter state/test clock seams separate from account lookup. Run the focused suite. <!-- sdd-owner: implementation -->

## 7. Local SMTP/Mailpit composition and API documentation

**Depends on:** 2–3 and deployment-owned `PUBLIC_APP_URL`. **Repository surfaces:** `backend/src/infrastructure/{config/emailConfirmationConfig.ts,mail/NodemailerSmtpMailAdapter.ts,mail/emailConfirmationTemplate.ts,logging/**}`, `backend/src/infrastructure/routes/api/users.ts`, `backend/src/infrastructure/openapi/**`, `backend/.env.example` or repository-established environment-example discovery target, root `docker-compose.yml`, `backend/package.json`, `pnpm-lock.yaml`, and colocated config/mail/OpenAPI tests.

- [ ] **RED — add adapter/config tests** for required validated origin and SMTP environment parsing, fake Nodemailer transport submission, escaped Spanish template content, absolute trusted-origin URL, stable non-secret record-id key, and allowlisted sanitized SMTP failures; add OpenAPI tests for body contracts, `204`, generic `400`, and the identical generic `202` contract for every syntactically valid resend request, including limited requests. Run focused backend config/mail/OpenAPI tests. <!-- sdd-owner: implementation -->
- [ ] **GREEN — add only `nodemailer` and required types, compose the MailPort adapter, environment-example placeholders, and Mailpit service (`1025` SMTP, `8025` UI/API)**; no credentials in git and no provider, queue, retry, or delivery claims. Run focused tests and `pnpm --filter backend test -- --runInBand backend/src/infrastructure/openapi`. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE — validate startup failures and adapter outcomes** for localhost HTTP versus production HTTPS, empty local SMTP credentials, invalid origin variants, transport rejection, and log redaction; verify generated OpenAPI exposes no account/token detail. Run `pnpm --filter backend test -- --runInBand backend/src/infrastructure/config backend/src/infrastructure/mail backend/src/infrastructure/openapi`. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR — keep composition/config/template/transport decoupled and below 250 lines**; label Mailpit acceptance as local transport acceptance only. Run `pnpm --filter backend test -- --runInBand backend/src/infrastructure`. <!-- sdd-owner: implementation -->

## 8. Frontend neutral confirmation and resend UI

**Depends on:** 4 and 6. **Repository surfaces:** `frontend/src/pages/confirm-email.astro`, `frontend/src/domains/auth/components/EmailConfirmationForm.astro`, `frontend/src/domains/auth/services/emailConfirmation.service.ts`, `frontend/src/styles/components/email-confirmation.css`, `frontend/src/layouts/Layout.astro`, and colocated frontend tests.

- [ ] **RED — add Vitest/component tests** that prove page load and Astro rendering make no mutation request, explicit submit reads the query token only in ephemeral browser memory and POSTs JSON `{ token }`, success/generic-invalid/network states are distinct, focus/live feedback is accessible, and resend uses JSON `{ email }` with non-enumerating acceptance copy. Run `pnpm --filter frontend test -- --runInBand`. <!-- sdd-owner: implementation -->
- [ ] **GREEN — implement the neutral page, accessible explicit-submit component/service, focused styles, and optional resend form** without rendering/storing token text, account state, or delivery guarantees. Run `pnpm --filter frontend test` and `pnpm --filter frontend check`. <!-- sdd-owner: implementation -->
- [ ] \*\*TRIANGULATE — cover missing/invalid query token, repeated submit, generic `400`, generic `202` resend acceptance including limited cases, network/5xx retry, keyboard focus, and no local/session storage/cookie/analytics leakage. Run `pnpm --filter frontend test` and `pnpm --filter frontend check`. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR — reuse existing auth tokens/layout conventions and keep the page/component/service/style responsibilities small**; ensure no inline backend-served scripts are introduced. Run `pnpm --filter frontend check && pnpm --filter frontend build`. <!-- sdd-owner: implementation -->

## 9. Focused local E2E and final verification

**Depends on:** 1–8. **Repository surfaces:** `e2e/tests/auth.spec.ts`, `e2e/tests/cart.spec.ts`, `e2e/tests/order-history.spec.ts`, new focused `e2e/tests/email-confirmation.spec.ts`, `e2e` Playwright config/fixtures discovery targets, local compose/test environment files, and any test-only Mailpit HTTP client helper.

- [ ] **RED — create focused Playwright scenarios and test setup** that start/use Mailpit with raised-but-enabled test limiter settings: register with required image, verify browser cookies/authentication and unchanged redirect, retrieve the accepted local SMTP message through Mailpit’s test-only API, open its GET link and prove database state remains unverified/unconsumed, submit confirmation, and assert verified/consumed state. Add unverified login/account/cart/checkout regression cases. Run `pnpm test:e2e -- --grep "email confirmation"`. <!-- sdd-owner: implementation -->
- [ ] **GREEN — implement only test composition/fixtures needed to drive the completed slice**, keeping assertions explicit that SMTP acceptance is not inbox or production delivery. Run the focused E2E command. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE — add browser/privacy/failure cases** for invalid link token generic UI, repeated successful submit, resend no-enumeration with generic `202` for limited cases, and unavailable SMTP retaining registration/session/token. Run `pnpm test:e2e -- --grep "email confirmation|unverified"`. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR — isolate Mailpit test-only API helpers and reset limiter/database state reliably** so focused tests remain repeatable and do not weaken existing auth/cart/checkout coverage. Run `pnpm test:e2e`. <!-- sdd-owner: implementation -->
- [ ] **Run final quality gates and record evidence**: `pnpm test:fast`, `pnpm test:integration`, `pnpm --filter frontend check`, `pnpm --filter frontend build`, backend OpenAPI/architecture checks, `pnpm test:e2e`, and `pnpm test:all`; report any coverage risk-map gaps honestly and confirm no production-delivery/access-gate claims. <!-- sdd-owner: implementation -->

## Parent lifecycle actions

- [ ] Start or reuse bounded review for each of the four ordered stacked-to-main slices, confirming its predecessor, tests, rollback boundary, and changed-line count are within the 400-line budget; require an additional dependency-safe slice rather than a size exception when needed. <!-- sdd-owner: parent -->
- [ ] Confirm final evidence satisfies all four change specs and that the complete change has no unresolved claim beyond its local Mailpit slice. <!-- sdd-owner: parent -->
