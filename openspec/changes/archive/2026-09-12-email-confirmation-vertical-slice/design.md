# Design: Locally Demoable Email Confirmation Vertical Slice

## Decision summary

This slice adds durable email verification and a complete local Mailpit flow without changing who may use the application. The existing registration controller continues to accept the required multipart image, return the same `201` body, establish the same cookie session, and support the frontend redirect to `/`. Email-confirmation persistence and SMTP delivery are post-user-commit side effects whose failures cannot reverse that result.

The core owns provider-neutral ports and use cases; Sequelize, Express, SMTP, environment parsing, and Astro remain adapters. The first slice deliberately uses direct post-commit SMTP and in-process rate limits. It introduces no queue, outbox, worker, microservice, retry service, or verification-based access gate.

## Current architecture and compatibility baseline

Repository evidence establishes these constraints:

- Backend layering is enforced under `backend/src/{domain,application,infrastructure,database}`. Application code may import only domain entities, ports, exceptions, and application DTOs; use-case-to-use-case imports are currently rejected by the architecture check.
- `UserApiController.register` checks the upload, delegates to `RegisterUserUseCase`, calls `establishSession`, and returns the existing `201` user envelope.
- `/api/users/register` runs `registerLimiter`, multipart upload, existing validators, and validation-error handling in that order.
- Authentication is cookie based: `m3d_auth`, `m3d_refresh`, `m3d_csrf`, and display state are established by current session helpers. The browser registration form expects those cookies and redirects to `/` after success.
- Authorization, cart, account, roles, and checkout depend on the current authenticated session, not verification state.
- Sequelize models are JavaScript definitions, repositories are TypeScript adapters, MySQL migrations are managed through Umzug, and MySQL DDL may auto-commit statement by statement.
- Astro is served separately from the Express API. Therefore `/confirm-email` belongs to the frontend, while state-changing routes remain under `/api/users/email-confirmation/*`.

This design treats stale JWT-in-JSON and `express-session` specifications as superseded by the accepted cookie behavior. It does not rewrite session mechanics: confirmation neither issues, rotates, clears, nor validates session cookies, and unverified users retain all current access.

## Component boundaries

Production code follows cohesive responsibility and dependency seams: contracts, use cases, adapters, configuration, and route middleware are separated where their reasons to change differ. File length is reviewed only as a diagnostic signal, not as a mandatory threshold.

### Domain/core contracts

| File                                                               | Responsibility                                                                                                                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/domain/entities/User.ts`                              | Add internal `emailVerifiedAt` with nullable `Date` type; no DTO field is added.                                                                                                                          |
| `backend/src/domain/entities/EmailConfirmationToken.ts`            | Represent record id, user id, digest, expiry, consumed/invalidated timestamps, creation time, and active slot. Never contain plaintext.                                                                   |
| `backend/src/domain/entities/NormalizedEmail.ts`                   | Pure `trim().toLowerCase()` normalization used by resend and account-limit keys, matching the existing account limiter and case-insensitive lookup behavior without changing registration/login payloads. |
| `backend/src/domain/ports/EmailConfirmationTokenRepositoryPort.ts` | Transaction-aware token lookup, user locking, invalidation, insertion, and conditional consumption operations.                                                                                            |
| `backend/src/domain/ports/MailPort.ts`                             | Core-owned provider-neutral confirmation delivery intent. Physical placement follows the repository's enforced `domain/ports` convention although the boundary is application-owned conceptually.         |
| `backend/src/domain/ports/ConfirmationTokenGeneratorPort.ts`       | Generate an opaque token; infrastructure supplies the CSPRNG.                                                                                                                                             |
| `backend/src/domain/ports/PublicOriginPort.ts`                     | Build an absolute confirmation URL from trusted configuration, never request headers.                                                                                                                     |
| `backend/src/domain/ports/ClockPort.ts`                            | Supply one controllable `now` value for expiry and tests.                                                                                                                                                 |
| `backend/src/domain/ports/EmailConfirmationIssuerPort.ts`          | Lets registration invoke issuance without an application use-case importing another use-case, preserving the architecture rule.                                                                           |
| `backend/src/domain/ports/EmailConfirmationRateLimitPort.ts`       | In-process account send reservation/release seam for resend orchestration.                                                                                                                                |
| `backend/src/domain/exceptions/InvalidEmailConfirmationToken.ts`   | Internal invalid outcome mapped to the single external `400` contract.                                                                                                                                    |

`MailPort` has exactly this shape:

```ts
interface MailPort {
  sendEmailConfirmation(intent: {
    to: string;
    confirmationUrl: string;
    expiresAt: Date;
    idempotencyKey: string;
  }): Promise<void>;
}
```

The idempotency key is the non-secret token record id serialized with a stable prefix; it contains neither email nor token material.

### Application use cases

| File                                                                  | Responsibility                                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend/src/application/use-cases/IssueEmailConfirmationUseCase.ts`  | Create/replace one token transactionally, then build the URL and call `MailPort` after commit. Implements `EmailConfirmationIssuerPort`.                           |
| `backend/src/application/use-cases/ConfirmEmailUseCase.ts`            | Hash submitted plaintext, enforce validity, and atomically verify plus consume.                                                                                    |
| `backend/src/application/use-cases/ResendEmailConfirmationUseCase.ts` | Normalize email, preserve non-enumeration, reserve account send capacity, issue only for an eligible unverified account, and propagate only persistence failures.  |
| `backend/src/application/use-cases/RegisterUserUseCase.ts`            | Preserve current creation/DTO logic; after `userRepo.create` has committed, invoke the issuer and sanitize/catch issuance failures so registration still succeeds. |

The existing `UserDTO` remains byte-for-byte compatible. No verification property is added to registration, login, refresh, list, or detail responses in this slice.

### Infrastructure and database

| File                                                                                   | Responsibility                                                                                                                               |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/database/migrations/<timestamp>-email-confirmation.js`                    | Add/backfill `email_verified_at`; create and index the token table; reverse in dependency-safe order.                                        |
| `backend/src/database/models/User.js`                                                  | Map nullable `emailVerifiedAt` to `email_verified_at`.                                                                                       |
| `backend/src/database/models/EmailConfirmationToken.js`                                | Sequelize model for digest-only token records.                                                                                               |
| `backend/src/database/models/index.js`, `db.d.ts`                                      | Register model, association, and TypeScript attributes.                                                                                      |
| `backend/src/infrastructure/repositories/SequelizeEmailConfirmationTokenRepository.ts` | MySQL locking and conditional updates using the opaque transaction context.                                                                  |
| `backend/src/infrastructure/repositories/SequelizeUserRepository.ts`                   | Map internal verification state and provide transaction-scoped lock/update operations required by the new port contract.                     |
| `backend/src/infrastructure/security/CryptoConfirmationTokenGenerator.ts`              | Generate 32 random bytes and encode base64url (256 bits, exceeding the 128-bit minimum).                                                     |
| `backend/src/infrastructure/security/Sha256TokenHasher.ts`                             | Reuse the existing SHA-256 adapter; persisted digest is 64 lowercase hexadecimal characters.                                                 |
| `backend/src/infrastructure/config/emailConfirmationConfig.ts`                         | Parse and validate trusted public origin plus SMTP settings at composition time.                                                             |
| `backend/src/infrastructure/mail/NodemailerSmtpMailAdapter.ts`                         | Submit text/HTML confirmation mail to generic SMTP; Mailpit works through local configuration.                                               |
| `backend/src/infrastructure/mail/emailConfirmationTemplate.ts`                         | Escape interpolated values and render the small Spanish confirmation message.                                                                |
| `backend/src/infrastructure/rate-limit/emailConfirmationAccountLimiter.ts`             | Single-process sliding-window/minimum-interval reservation store keyed by normalized email.                                                  |
| `backend/src/infrastructure/middlewares/resendConfirmationIpLimiter.ts`                | Five syntactically accepted resend requests per trusted `req.ip` per hour.                                                                   |
| `backend/src/infrastructure/middlewares/confirmationAttemptLimiter.ts`                 | Thirty POST confirmation attempts per trusted `req.ip` per 15 minutes.                                                                       |
| `backend/src/infrastructure/middlewares/validators/emailConfirmationValidators.ts`     | JSON body validation for token/email; never perform persistence lookup.                                                                      |
| `backend/src/infrastructure/controllers/EmailConfirmationApiController.ts`             | Thin status/error mapping with generic external responses.                                                                                   |
| `backend/src/infrastructure/routes/api/users.ts`                                       | Composition root and the two new unauthenticated POST routes. Existing registration middleware order and controller response stay unchanged. |
| `backend/src/infrastructure/openapi/*`                                                 | Document body contracts, `204`, generic `400`, generic `202`, and the unresolved limited-resend status without exposing account state.       |

`nodemailer` and its types are the only planned delivery dependencies. SMTP configuration is environment-backed (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional `SMTP_USER`/`SMTP_PASS`, and `SMTP_FROM`). Empty local credentials are valid; real secrets remain outside git. `docker-compose.yml` adds a Mailpit service exposing SMTP `1025` and UI/API `8025`, and backend local configuration points to it. This is demo infrastructure only.

### Frontend

| File                                                               | Responsibility                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/pages/confirm-email.astro`                           | Render a neutral page for every GET; never call a mutation during Astro rendering or page initialization.                             |
| `frontend/src/domains/auth/components/EmailConfirmationForm.astro` | Accessible explicit-submit UI with idle, submitting, success, generic-invalid, and retryable-network states.                          |
| `frontend/src/domains/auth/services/emailConfirmation.service.ts`  | On submit only, read `token` from `window.location.search` and send JSON `{ token }` to the API. Also expose resend JSON `{ email }`. |
| `frontend/src/styles/components/email-confirmation.css`            | Reuse auth tokens/layout with focused confirmation states; imported from `Layout.astro`.                                              |

The token remains in the link/query string and in ephemeral browser memory only. It is not rendered into page copy, analytics, logs, local/session storage, cookies, or error messages. GET always presents the same neutral prompt. A successful POST shows a confirmed state; generic `400` shows one expired-or-invalid message; transport/`5xx` shows a retry action. The page may include a small resend form with the same generic “If the account is eligible…” acceptance copy and must never claim delivery.

## Persistence model and migration

### `User` change

`email_verified_at DATETIME NULL DEFAULT NULL` is added. The migration executes one `UPDATE User SET email_verified_at = <captured migration timestamp> WHERE email_verified_at IS NULL` before application rollout. Every pre-existing row receives the same timestamp; post-migration inserts omit the column and remain null.

### `EmailConfirmationToken` table

| Column                        | Shape and purpose                                                              |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `id_email_confirmation_token` | `BIGINT UNSIGNED`, auto-increment primary key and idempotency identity.        |
| `id_user`                     | Required FK to `User.id_user`, `ON DELETE CASCADE`.                            |
| `token_hash`                  | `CHAR(64)`, required, globally unique SHA-256 hex digest.                      |
| `expires_at`                  | Required `DATETIME`; exactly `created_at + 24 hours`.                          |
| `consumed_at`                 | Nullable `DATETIME`; set only by successful confirmation.                      |
| `invalidated_at`              | Nullable `DATETIME`; set when replacement supersedes a token.                  |
| `active_slot`                 | Nullable `TINYINT`; value `1` only while authoritative, then null.             |
| `created_at`                  | Required `DATETIME`, supplied from the same application clock value as expiry. |

A unique index on `(id_user, active_slot)` uses MySQL's multiple-NULL behavior: at most one row per user can have `active_slot = 1`, while historical rows can all have null. Indexes also cover `token_hash` and `(id_user, created_at)`. Usable means active slot `1`, both terminal timestamps null, and `expires_at > now`.

`invalidated_at` is intentionally separate from `consumed_at`: a superseded token was not successfully consumed, and must remain a generic `400` even if the user later becomes verified. No plaintext column exists.

The migration records statement-attributed failures because MySQL DDL auto-commit means a JavaScript transaction is not full rollback protection. `down` drops the token table first, then `email_verified_at`; it cannot restore the meaning of confirmations already performed, so down is intended only for controlled rollback after application code is removed.

## Transaction and orchestration flows

### Registration: preserve `201` and immediate session

1. Existing upload and validation run unchanged.
2. `RegisterUserUseCase` checks duplicate email, hashes the password, and inserts the user. That insert commits through the current repository/autocommit boundary; the new model default leaves the user unverified.
3. Only after successful user creation, call `IssueEmailConfirmationUseCase` in registration mode.
4. The issuer commits token replacement in its own transaction. On persistence failure it makes no mail call and throws; registration catches it and logs a sanitized operational event.
5. After token commit, construct the absolute frontend URL and call `MailPort`. Mail errors are sanitized and swallowed by the issuer; the committed token remains usable.
6. Return the unchanged `UserDTO`. The existing controller then calls `establishSession` and emits its unchanged `201` body/cookies; the frontend keeps broadcasting login and redirecting to `/`.

This ordering means user-creation failure creates neither token nor mail. Token/mail failure cannot undo the user, response, or session. It also avoids pretending that SMTP and cookie issuance share a transaction. Tests assert call order rather than describing the cookie as database-committed.

### Atomic create or replacement

Inside one `UnitOfWorkPort` transaction:

1. Lock the user row `FOR UPDATE` by user id; all replacement and confirmation paths use this as their first authoritative lock.
2. If the user is already verified, return `not-eligible` without changing tokens.
3. Set `invalidated_at = now, active_slot = NULL` on any current active row.
4. Insert the new row with the digest, `created_at = now`, `expires_at = now + 24h`, and `active_slot = 1`.
5. Commit and return `{ recordId, plaintext, expiresAt, recipient }` only to the in-memory orchestrator.

The user lock serializes concurrent resends; the unique active-slot index is a database backstop. Plaintext exists only from CSPRNG generation through URL construction/mail submission and is never passed to persistence or logging.

### Atomic confirmation

1. Validate only a bounded opaque token string at the HTTP edge, hash it before repository use, and perform an untrusted digest lookup to learn a candidate user id. A miss becomes the generic invalid outcome.
2. Start a transaction, lock that user row first, then refetch the token by digest `FOR UPDATE`.
3. If `invalidated_at` is non-null, the active slot is absent without `consumed_at`, or expiry is not strictly in the future, return generic invalid and roll back/no-op.
4. If `consumed_at` is non-null and the locked user is verified, return idempotent success without mutation. A consumed token without a verified user is treated as invalid/inconsistent and logged only by sanitized category.
5. For a current token, conditionally update the user from null to `email_verified_at = now`, then set `consumed_at = now, active_slot = NULL` on that same token. Both changes commit together; any failure rolls both back.
6. Return `204` for the winner and a retry that observes consumed+verified. Return the same generic `400` for missing, malformed, unknown, expired, or superseded input.

Confirmation and resend both lock the user before locking/changing token rows, preventing a resend/confirm race from leaving two authorities. A confirmation that began from a stale prelookup refetches after obtaining the user lock and therefore rejects a token invalidated by the winning resend.

### Resend and rate-limit ordering

Route order is JSON parsing → resend email syntax/normalization validation → accepted-request IP limiter → controller/use case. Thus malformed input is `400`; every non-limited syntactically valid request consumes the accepted IP budget without consulting account existence.

The use case performs a normalized lookup. Missing or verified accounts return the same generic accepted result with no token/mail. For an apparently eligible account, the in-process account limiter atomically reserves one send slot only if fewer than three reservations exist in the prior hour and at least 60 seconds elapsed. The issuance transaction rechecks verification under the user lock. If it becomes ineligible or persistence fails before SMTP invocation, release the reservation; once `MailPort` is invoked, retain it even if SMTP rejects because an actual delivery attempt occurred. A committed replacement produces at most one direct mail call.

The exact limited-resend status (`202` versus `429`) remains a required product decision before route implementation; response content must remain non-enumerating either way. Confirmation limiting runs before token validation so every attempt counts and its response never describes token state. All limiters rely on Express's existing trusted `req.ip` behavior (`trust proxy = 1`) and use process-local stores only.

## Trusted origin and configuration

The URL builder receives a validated canonical origin through dependency injection. Startup validation requires an absolute HTTP(S) URL with no credentials, query, fragment, or non-root path; production requires HTTPS, while localhost HTTP is allowed for the demo. URL construction uses `new URL('/confirm-email', configuredOrigin)` and sets only the encoded `token` query parameter. `req.host`, `Host`, `Origin`, `Referer`, and forwarded headers are never inputs.

The exact public-origin environment variable name and deployment owner remain explicitly deferred, as required by the proposal. Implementation must choose that name as a small configuration decision before coding; until then tests inject `PublicOriginPort` directly. This does not defer validation or trust semantics.

## HTTP contracts

| Route                                        | Middleware and result                                                                                                                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /confirm-email?token=…`                 | Astro page only. No API call on load and no state mutation. Always neutral presentation.                                                                                                                          |
| `POST /api/users/email-confirmation/confirm` | Unauthenticated JSON; confirmation-attempt IP limiter precedes bounded token validation; `{ token: string }`; valid/idempotent `204`; all specified invalid classes use one generic `400`.                        |
| `POST /api/users/email-confirmation/resend`  | Unauthenticated JSON; email validation then accepted-request IP limit; `{ email: string }`; non-limited syntactically valid requests use identical generic `202`; malformed input `400`; limited status deferred. |

Neither POST route uses `apiAuthMiddleware`; confirmation authority is the opaque token and resend is intentionally account-agnostic. They do not alter cookies. The existing API currently has no globally mounted CSRF guard, and this slice does not invent a session-dependent CSRF contract for these unauthenticated endpoints. Existing CORS, JSON size handling, request IDs, Helmet policy, and centralized errors remain in force.

Controllers map only recognized application outcomes. Unexpected resend persistence failures reach the centralized generic server error and do not trigger mail. No response says “sent” or reveals absent/verified/eligible state.

## Logging and failures

Allowed structured fields are `event`, sanitized `outcome`, `requestId`, internal `userId`, and token `recordId`. Approved outcomes include `token_persist_failed`, `smtp_accepted`, `smtp_failed`, `confirmation_invalid`, and `confirmation_inconsistent`. Email, plaintext token, confirmation URL, digest, SMTP credentials, raw request body, and raw adapter/provider response are forbidden.

Raw thrown errors are not passed to the logger because SMTP messages may contain recipient or connection details. Adapters map them to an allowlisted error class/code; logging records the category only. Request logging must redact confirmation query/body fields so browser/API access logs cannot capture plaintext. Tests inspect captured logger arguments, HTTP bodies, database rows, idempotency keys, and mail fakes for forbidden leakage.

## Strict-TDD implementation sequence

Each step follows RED → GREEN → TRIANGULATE → REFACTOR, with production code added only after the focused failing test.

1. **Migration/model RED:** real-MySQL tests for existing-user backfill, new null default, table constraints, digest-only shape, unique active slot, and dependency-safe down. Then implement migration/models/types.
2. **Domain/security RED:** unit tests for 32-byte CSPRNG output, SHA-256 digest, exact clock-controlled 24 hours, normalization, trusted-origin rejection/building, and DTO non-exposure. Then add contracts/adapters.
3. **Replacement RED:** repository integration tests for atomic invalidation+insert, concurrent replacements, persistence rollback, and unique active authority. Then implement repository and issuer transaction.
4. **Confirmation RED:** application and real-MySQL tests for winner/retry `204` outcomes, atomic rollback, expired/unknown/superseded equivalence, concurrent confirms, and resend/confirm races. Then implement use case.
5. **Registration regression RED:** controller/route tests pin multipart image requirement, exact existing `201` body, cookie headers, duplicate race/upload cleanup, redirect behavior, token failure, SMTP failure, and call ordering. Then wire optional post-commit issuance without altering DTO/session code.
6. **Resend/rate-limit RED:** fake-clock unit tests plus route tests for normalization, absent/verified/eligible indistinguishability, five/IP/hour, three attempts-to-send/account/hour, 60 seconds, reservation release, and 30 confirmation attempts/IP/15 minutes. Resolve the limited status before GREEN.
7. **SMTP/config RED:** adapter contract tests against a fake SMTP transport, startup config validation, escaped template, stable record-id key, and sanitized errors. Then add Nodemailer/Mailpit configuration and compose service.
8. **Frontend RED:** Vitest/service/component tests prove no request on page load, POST-body token submission, generic states, accessible focus/live feedback, and generic resend copy. Then add Astro page and styles.
9. **Focused E2E RED:** extend Playwright setup with Mailpit and raised-but-enabled new limiter settings; register with required image, assert browser remains authenticated, retrieve the local message through Mailpit's test-only HTTP API, open GET and prove DB state unchanged, submit POST, and prove verification. Add login/account/cart/checkout regression coverage for an unverified user.
10. **Final gates:** architecture check, backend unit/integration, frontend tests/check/build, OpenAPI check, Playwright, then `pnpm test:all`. Evidence describes SMTP acceptance only, never production delivery.

Test seams are `ClockPort`, token generator, hasher, `MailPort`, `PublicOriginPort`, logger, account limiter, opaque transaction context, and Nodemailer transport injection. Real persistence tests remain mandatory for locking and MySQL index behavior; mocks alone cannot validate races.

## Rollout and rollback

### Rollout

1. Apply migration before deploying code that reads the new fields.
2. Verify pre-existing users are non-null verified and a post-migration fixture defaults null.
3. Deploy backend with trusted origin and local SMTP configuration; fail startup on malformed required configuration rather than deriving request origin.
4. Start Mailpit for local demo, then deploy the Astro page.
5. Run the focused browser path and regression suite. Verification remains informational, so partial mail outages do not block existing usage.

### Rollback

1. Remove/disable frontend confirmation and resend surfaces and backend route wiring first.
2. Remove direct local SMTP configuration/adapter wiring; existing sessions and users continue normally.
3. Only in a controlled environment, run migration down after application readers are removed: drop token table, then user column.
4. Do not promise preservation of verification events across schema rollback. If preserving that data becomes necessary, take an explicit backup/export before down; no production retention policy is invented here.

A mail outage alone does not require schema rollback: keep committed users/tokens, log sanitized failures, and use manual resend as the only recovery mechanism in this slice.

## Explicitly deferred production choices

- Production mail provider, adapter ownership, credentials, domain authentication, provider quotas, delivery SLA, bounce/complaint/webhook handling, and provider message IDs.
- Queue, outbox, worker, microservice, automatic retry, distributed delivery, and operational retry ownership.
- Shared/multi-process rate-limit store and limiter retention policy.
- Whether a limited resend returns generic `202` or non-enumerating `429`.
- Consumed/expired/invalidated token cleanup and retention.
- Public-origin environment variable name and deployment ownership (trust and validation rules are decided).
- Verification-state DTO exposure and public field naming.
- Production rollout topology and observability/alert thresholds.
- Any verification-based access, authorization, checkout, cart, role, login, or account gating.

## Review checklist

- Registration still owns the same upload, `201`, response, cookie session, and redirect behavior.
- New users are internally unverified; old users are backfilled; DTOs remain unchanged.
- Replacement and confirmation are separately atomic and serialize on the user row.
- GET never mutates; only POST-body confirmation does.
- Plaintext appears only in ephemeral generation/link/mail flow and is redacted from observability.
- SMTP is behind `MailPort`, called only after token commit, and described as local acceptance.
- Local limits are enforceable in one process and production distribution remains visibly deferred.
- No queue, outbox, worker, microservice, production provider, or access gate enters the first slice.
