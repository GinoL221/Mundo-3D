# Email Confirmation Contract

## Status and intent

This document originated as the design contract for the provider-agnostic email-confirmation capability. Stage one (migration `20260902000000-email-confirmation.js`, `MailPort`, Nodemailer SMTP adapter, and the `POST` confirmation/resend endpoints in `backend/src/infrastructure/routes/api/users.ts`) is now implemented; the sections below preserve the original design constraints alongside the implemented HTTP contract.

## Current verified facts

The following facts are verified from the current repository and must remain compatible:

- `backend/src/infrastructure/controllers/UserApiController.ts` requires an uploaded profile image, creates the user, establishes the session, and returns HTTP `201`.
- `backend/src/infrastructure/routes/api/users.ts` exposes `POST /api/users/register` as `multipart/form-data`; `image` is required and upload processing precedes registration validation.
- `frontend/src/domains/auth/components/RegisterForm.astro` submits `FormData`, expects successful registration to establish the session, broadcasts the logged-in state, and redirects to `/`.
- Login currently establishes cookie-based sessions. Registration must continue issuing the same immediate session cookies.
- Checkout and other authenticated behavior currently depend on session authentication, not email verification.
- Verification state (`User.email_verified_at`), `EmailConfirmationToken` persistence, Nodemailer SMTP mail adapter (`NodemailerSmtpMailAdapter`), and the `POST /api/users/email-confirmation/confirm` and `POST /api/users/email-confirmation/resend` endpoints are implemented in `backend/src/infrastructure/routes/api/users.ts`.
- Existing OpenSpec auth/session documents may contain stale Bearer-JWT or `express-session` statements. Implementation planning must reconcile those statements with the current cookie-based behavior rather than silently rewriting them.

## Approved product decisions

1. New accounts may be unverified without losing any current access.
2. Existing users are backfilled as verified during the schema rollout.
3. Registration preserves its required image, multipart request, HTTP `201` response, response body, and immediate session-cookie behavior.
4. Verification status does not gate login, checkout, cart, account access, roles, or any other existing behavior.
5. Stage one ends at a provider-agnostic mail boundary and a direct post-commit adapter with tests; no production provider is selected or integrated.

## Proposed architecture

### Domain port

Define a provider-neutral `MailPort` owned by the domain layer (`backend/src/domain/ports/MailPort.ts`):

```ts
interface MailPort {
  sendEmailConfirmation(message: {
    to: string;
    confirmationUrl: string;
    expiresAt: Date;
    idempotencyKey: string;
  }): Promise<void>;
}
```

The port accepts delivery intent only. It must not expose provider message IDs, templates, SDK types, credentials, or retry semantics to domain/application code.

### Direct post-commit adapter

After user creation and its database transaction commit:

1. Create or replace the user's active confirmation token.
2. Build an absolute confirmation URL from trusted server configuration.
3. Invoke `MailPort.sendEmailConfirmation` directly.
4. Record a structured success or failure event without token plaintext or unnecessary personal data.
5. Return the existing registration result independently of the mail outcome.

“Post-commit” is mandatory: no mail call may occur inside the user-creation transaction, and mail failure must never roll back a committed user. `NodemailerSmtpMailAdapter` (`backend/src/infrastructure/mail/NodemailerSmtpMailAdapter.ts`) implements this direct post-commit SMTP delivery; stage one intentionally has no queue, outbox, or worker.

## Proposed data model

### User verification state

Add nullable `email_verified_at` to the persisted user model:

- Existing rows: backfill to the migration timestamp, then enforce the intended nullability contract.
- New rows: `NULL` until successful confirmation.
- Verified means `email_verified_at IS NOT NULL`.
- Public/auth DTO exposure is optional until a consumer is approved; absence from current responses preserves compatibility.

### Confirmation tokens

Use a dedicated table (`EmailConfirmationToken` in `20260902000000-email-confirmation.js`) rather than storing token state on the user:

| Field                         | Contract                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `id_email_confirmation_token` | `BIGINT UNSIGNED` auto-increment primary key                                               |
| `id_user`                     | `INT NOT NULL`, FK to `User.id_user` (`ON DELETE CASCADE`, `ON UPDATE CASCADE`)            |
| `token_hash`                  | `CHAR(64) NOT NULL`, unique index `uq_email_confirmation_token_hash`; plaintext is never persisted |
| `expires_at`                  | `DATETIME NOT NULL`, required absolute expiry                                              |
| `consumed_at`                 | `DATETIME NULL`, null until successful use                                                 |
| `invalidated_at`              | `DATETIME NULL`, null until superseded/invalidated                                         |
| `active_slot`                 | `TINYINT NULL`, unique index `uq_email_confirmation_token_user_active_slot` on `(id_user, active_slot)` |
| `created_at`                  | `DATETIME NOT NULL`, index `idx_email_confirmation_token_user_created` on `(id_user, created_at)` |

Only one usable token per user may exist. Creating a token for registration or resend invalidates any prior unconsumed token for that user. Persist token creation/replacement atomically; send mail only after that commit.

## Implemented HTTP API

*(Nota: la propuesta inicial contemplaba `GET /api/users/email-confirmation?token=...`, pero la implementación adoptó `POST` con el token únicamente en el cuerpo JSON, consumido desde `/confirm-email`.)*

### Confirm email

`POST /api/users/email-confirmation/confirm`

- Unauthenticated; rate-limited per trusted IP (`emailConfirmationAttemptLimiter`, 30 attempts / 15 min).
- JSON request body: `{ "token": "<opaque-token>" }` (string, 16–512 characters).
- Valid, unexpired, unused token: set `email_verified_at` once, consume the token atomically, return `204 No Content`.
- Token already consumed for an already verified user: return `204 No Content` to make browser retries idempotent.
- Missing, malformed, unknown, expired, or superseded token: return `400 Bad Request` with `{ "error": "Invalid email confirmation token" }`; do not reveal which condition applied (rate-limited requests return `429` with the same generic error body).
- The endpoint does not establish, replace, or revoke session cookies.

### Resend confirmation

`POST /api/users/email-confirmation/resend`

- Unauthenticated; rate-limited per trusted IP (`resendConfirmationIpLimiter`) and per normalized account (`EmailConfirmationAccountLimiter`).
- JSON request body: `{ "email": "<email>" }` (validated for email syntax; invalid syntax returns `400`).
- Always return `202 Accepted` with `{ "message": "If the account is eligible, a confirmation email will be sent." }` for syntactically valid input, whether the account is absent, already verified, rate-limited, or eligible, to prevent account enumeration.
- For an eligible unverified account, replace the active token and invoke the mail port after commit.
- It does not require an authenticated session and does not change existing login behavior.

## Security and privacy rules

- Generate opaque tokens with a cryptographically secure random source and at least 128 bits of entropy.
- Store only a one-way token digest; compare digests using a timing-safe method where applicable.
- Tokens are single-purpose, single-use, user-bound, and time-limited.
- Never place token plaintext in logs, metrics, database rows, error bodies, analytics, or mail-port idempotency keys.
- Build links only from an allowlisted/configured public origin; never trust request `Host`, `Origin`, or forwarded headers.
- Normalize email consistently with registration/login before lookup.
- Generic resend and invalid-token responses must not disclose account existence or verification state.
- Structured logs may include internal user ID, outcome category, request ID, and token record ID; omit the email address by default.
- Mail configuration and future provider credentials must come from environment variables and must never be committed.
- Confirmation must not elevate role, alter authorization, or rotate/reissue sessions.

## Failure semantics

| Failure                                   | Required behavior                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| User creation fails                       | No token is committed and no mail call occurs; existing registration error behavior remains.                  |
| Token persistence fails after user commit | Registration still returns `201` with session cookies; log an operational error. Resend is the recovery path. |
| Mail port rejects or times out            | Registration still returns `201` with session cookies; keep the token usable and log a sanitized failure.     |
| Resend token persistence fails            | `ResendEmailConfirmationUseCase` catches the error, releases the account-limiter reservation, does not invoke mail, and still returns `202` without disclosing account/delivery state. |
| Resend mail fails after token commit      | Preserve the new token, return `202`, and log a sanitized failure.                                            |
| Confirmation races with itself            | Exactly one atomic state transition wins; all successful retries resolve to `204`.                            |
| Confirmation races with resend            | A superseded token cannot verify; the currently active token remains authoritative.                           |
| Account already verified                  | Confirmation is idempotent; resend performs no mail call and still returns `202`.                             |

No response may claim that an email was delivered. A successful port call means only that the configured adapter accepted the request.

## Rate limits and idempotency

- Reuse the project's trusted client-IP handling; do not key solely on user-controlled headers.
- Proposed resend limits: at most 5 accepted requests per IP per hour and 3 actual sends per normalized account per hour, with a minimum 60-second interval between sends.
- Proposed confirmation limit: at most 30 attempts per IP per 15 minutes.
- Rate-limited resend responses remain non-enumerating and return `202` (both `resendConfirmationIpLimiter` and `EmailConfirmationAccountLimiter` via `ResendEmailConfirmationUseCase`).
- Token creation/replacement is serialized per user so concurrent resends leave one active token.
- Derive the mail idempotency key from the confirmation-token record identity, not from token plaintext or email. Repeating a call for the same record uses the same key; a resend creates a new record/key.
- In-memory limiters are acceptable only for local/single-process behavior; distributed enforcement is an open deployment decision.

## Test matrix

| Layer                         | Scenario                                         | Expected result                                                              |
| ----------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Registration controller/route | Valid multipart registration with required image | Existing `201`, response body, and session cookies are unchanged.            |
| Registration controller/route | Missing image                                    | Existing validation/error behavior is unchanged; no token or mail call.      |
| Application                   | User creation rolls back                         | No token and no mail call.                                                   |
| Application                   | User commits successfully                        | Unverified user and one active hashed token; mail called only after commit.  |
| Application                   | Token persistence fails post-commit              | Registration succeeds; mail not called; sanitized error logged.              |
| Application                   | Mail port fails                                  | Registration succeeds and token remains usable.                              |
| Migration                     | Existing users                                   | Every existing user is backfilled verified.                                  |
| Migration                     | New user                                         | `email_verified_at` starts null.                                             |
| Confirm endpoint              | Current valid token                              | User verified and token consumed atomically; `204`.                          |
| Confirm endpoint              | Repeated consumed token                          | No duplicate transition; `204`.                                              |
| Confirm endpoint              | Unknown, malformed, expired, or superseded token | Same generic `400` contract.                                                 |
| Confirm endpoint              | Concurrent confirmation                          | One transition; both successful/idempotent outcomes expose no race.          |
| Resend endpoint               | Unknown or already verified email                | `202`; no mail call; indistinguishable responses.                            |
| Resend endpoint               | Eligible unverified email                        | Prior token invalidated, one new token committed, one post-commit mail call. |
| Resend endpoint               | Concurrent requests                              | One final active token; limits and send count enforced.                      |
| Authorization regression      | Unverified user logs in                          | Current login and cookie behavior remains available.                         |
| Checkout regression           | Unverified user checks out                       | Existing checkout behavior remains unchanged.                                |
| Mail contract                 | Adapter receives intent                          | Provider-neutral payload and stable non-secret idempotency key only.         |
| Privacy                       | Logs and errors inspected                        | No token plaintext, provider secrets, or account-enumerating response.       |

## Open decisions

- Token lifetime and whether expiration is measured from creation or last resend.
- **Resolved & implemented**: Confirmation uses a browser page (`/confirm-email`) that submits `POST /api/users/email-confirmation/confirm` with `{ token }` in the JSON body.
- Exact generic error schema and frontend confirmation/resend user experience.
- Whether verification state should be added to auth/user DTOs and, if so, under what field name.
- **Resolved & implemented (status code)**: Resend preserves `202` for both IP and account rate limits for privacy; which shared store is required in multi-process production remains open.
- Cleanup/retention policy for expired and consumed token records.
- Retry strategy after the direct adapter stage (manual resend, bounded inline retry, queue, or transactional outbox).
- **Resolved & implemented**: Public origin configuration uses `PUBLIC_APP_URL` in `emailConfirmationConfig.ts` (with non-production local fallback defaults in `backend/src/infrastructure/routes/api/users.ts`).
- Reconciliation plan for stale OpenSpec JWT/session statements before implementation.

## Non-goals

- Selecting, configuring, or claiming support for a production email provider.
- Claiming that email delivery currently exists or guaranteeing inbox delivery.
- Blocking unverified users from login, checkout, cart, account, or current features.
- Changing registration fields, image requirements, multipart handling, status code, response body, or immediate session cookies.
- Changing existing login, refresh, logout, CSRF, checkout, or cart-hydration contracts.
- Password reset, email-address change confirmation, marketing email, or notification preferences.
- Queue, worker, outbox, webhook, bounce, complaint, or delivery-status processing in stage one.
