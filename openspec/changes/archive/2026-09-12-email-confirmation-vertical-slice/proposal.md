# Proposal: Email Confirmation as a Locally Demoable Vertical Slice

## Portfolio outcome

Mundo-3D will demonstrate an honest, end-to-end email-confirmation architecture that is reproducible locally, persists real verification state, and can be tested from registration through confirmation without pretending that a production email provider has been chosen. The slice adds useful account-verification capability while preserving the current registration, session, login, checkout, and account-access experience.

This proposal is for the first implementation slice only. It leads to a Mailpit/local-SMTP demo through a provider-agnostic application port; it does **not** claim production email delivery.

## Business problem

The portfolio currently has no durable way to prove that an account controls its email address. Adding confirmation without a bounded design could break the existing registration contract, gate checkout unexpectedly, expose account existence, or couple application code to an unselected provider. The change is worth doing now because a complete local vertical slice makes the security and architecture demonstrable while keeping operational commitments explicit.

## Target user situation

A newly registered customer should receive a confirmation message in the local Mailpit demo, open its link within 24 hours to reach a browser confirmation page, and submit that page to become verified. A customer who did not receive or lost the message should be able to request a resend without learning whether an email account exists. During and after this flow, the customer must retain the current immediate session, login, cart, account, and checkout behavior.

## User-approved product decisions

These decisions are binding for this change:

- New accounts start unverified, but verification does not gate login, checkout, cart, account access, roles, or any existing behavior.
- Existing users are backfilled as verified during the schema rollout.
- Registration continues to require the profile image and `multipart/form-data`, returns HTTP `201` with its current response body, establishes the immediate cookie session, and preserves redirect behavior.
- Confirmation uses the binding `/confirm-email?token=<opaque-token>` browser page followed by `POST /api/users/email-confirmation/confirm` with the token in the request body; the GET never mutates verification state.
- The first slice is a complete local vertical slice using a provider-agnostic `MailPort`, real persistence, hashed single-use tokens, 24-hour expiry, one active token, post-commit delivery, generic responses, rate limits, and focused unit/integration/E2E evidence.
- The first slice has no queue, outbox, worker, microservice, or concrete production provider.

## Scope

### In scope

1. Add persisted verification state (`email_verified_at`) and backfill existing users as verified.
2. Add a dedicated confirmation-token store containing a user reference, one-way token digest, expiry, consumed timestamp, and creation timestamp.
3. Generate opaque cryptographically secure tokens, persist only their hashes, allow one usable token per user, and invalidate a previous active token when a new registration/resend token is created.
4. Add the binding browser confirmation flow:
   - `GET /confirm-email?token=<opaque-token>` serves the confirmation page and never mutates verification state.
   - The page submits the opaque token in the request body to `POST /api/users/email-confirmation/confirm`.
   - A valid POST token verifies and consumes atomically, returning `204`.
   - Repeating a consumed token for an already verified user is idempotent and returns `204`.
   - Missing, malformed, unknown, expired, or superseded tokens share one generic `400` response from the state-changing POST; the GET page must not expose account or verification state.
5. Add the proposed resend endpoint:
   - `POST /api/users/email-confirmation/resend` with a normalized email address.
   - Syntactically valid requests return a generic `202`, whether the account is absent, verified, or eligible.
   - Eligible unverified accounts receive one replacement-token delivery after persistence commits.
6. Define an application-owned `MailPort` that accepts only confirmation intent (`to`, absolute confirmation URL, expiry, and a non-secret token-record idempotency key).
7. Provide a local demo adapter/configuration that sends through Mailpit-compatible local SMTP. Mailpit/local SMTP is a development transport for reproducibility, not a production-provider decision or delivery guarantee.
8. Use trusted configured public-origin settings for links, sanitized structured failure logging, and direct post-commit delivery. Mail failure must not roll back a committed user or token.
9. Apply focused unit, persistence/integration, route, regression, privacy, and E2E evidence, including GET non-mutation, POST-body confirmation, invalid-token privacy, unchanged registration/session, and unverified-checkout behavior.

### Explicit non-goals

- Selecting, integrating, or claiming support for any production email provider.
- Guaranteeing inbox delivery, provider acceptance beyond the local adapter, bounce handling, complaint handling, webhooks, or delivery-status tracking.
- Blocking or changing login, checkout, cart, account access, roles, or any current authorization behavior for unverified users.
- Changing registration fields, required image handling, multipart processing, HTTP `201`, response body, immediate cookies, redirect behavior, login, logout, CSRF, or checkout contracts.
- Password reset, email-address-change confirmation, marketing email, or notification preferences.
- Queue, transactional outbox, worker, retry service, microservice, or distributed delivery orchestration.
- Expanding current auth/user DTOs with verification state unless a later consumer decision approves it.

## Business rules and security/privacy constraints

- Verified means `email_verified_at IS NOT NULL`; new users begin with it null, while existing rows are backfilled to the migration timestamp.
- Tokens are single-purpose, single-use, user-bound, opaque, at least 128 bits of entropy, hashed at rest, and valid for exactly 24 hours from creation.
- Token confirmation and consumption are one atomic state transition. A superseded token cannot verify, and concurrent confirmation has one winner with idempotent successful retries.
- No token plaintext may appear in logs, metrics, database rows, analytics, error bodies, or idempotency keys. Logs omit email by default and use sanitized outcome categories and internal identifiers where needed.
- Confirmation URLs use an allowlisted/configured public origin; request `Host`, `Origin`, and forwarded headers are never trusted to construct links.
- Email normalization matches the existing registration/login rules.
- The confirmation page GET is presentation-only; only the confirmation POST may verify or consume a token.
- Resend, confirmation-page, and invalid-token responses must not disclose account existence or verification state.
- Reuse the project’s trusted client-IP handling. The initial limits are at most five accepted resend requests per IP per hour, three actual sends per normalized account per hour, a 60-second minimum between sends, and 30 confirmation attempts per IP per 15 minutes. Distributed enforcement remains unresolved for later deployment decisions.
- Credentials and SMTP configuration come from environment variables and are never committed. Local Mailpit defaults must not be represented as production credentials.

## Transport boundary: demo now, provider later

The application depends only on `MailPort`; it must not know about SMTP libraries, Mailpit APIs, provider SDKs, provider message IDs, credentials, or provider retry semantics. The first slice supplies a local SMTP adapter/configuration intended for Mailpit and local demonstration. A future production adapter, provider selection, credentials, delivery policy, retry model, and operational ownership are later decisions and must not be invented or implied by this proposal. A successful local port call means only that the configured adapter accepted the send request.

## Impacted areas

| Area                   | Impact | Expected change                                                                                                                                           |
| ---------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User schema/migrations |   High | Verification timestamp and token table; existing-user backfill and migration safety                                                                       |
| Application/domain     |   High | Token lifecycle, `MailPort`, post-commit orchestration, rate-limit policy                                                                                 |
| API routes/controllers |   High | Confirmation and resend endpoints while preserving registration behavior                                                                                  |
| Infrastructure         | Medium | Hashing, secure token generation, persistence, configured-origin URL building, local SMTP/Mailpit adapter, sanitized logging                              |
| Frontend/demo workflow | Medium | Only the minimum confirmation/resend surface needed to demonstrate the slice; no change to existing registration/session behavior                         |
| Tests/documentation    |   High | Focused unit, integration, route, E2E, regression, and privacy evidence; refer to `docs/diseno/email-confirmation-contract.md` rather than duplicating it |

## Acceptance boundary

The proposal is accepted when all of the following are true:

- A new local registration still uses required multipart image input, returns the existing `201` response and body, establishes the same immediate session cookies, and preserves redirect behavior.
- The new user is unverified, has one active hashed token expiring in 24 hours, and produces one post-commit Mailpit/local-SMTP delivery intent.
- Existing users are verified by migration and an unverified user can still log in, access the account, and complete checkout with current behavior.
- A valid confirmation link first serves a non-mutating browser page, then its POST body token atomically verifies and consumes the token with `204`; retries are idempotent; all invalid/superseded/expired forms share the generic error contract.
- Resend is non-enumerating, rate-limited, replaces the active token safely under concurrency, and does not send for unknown or already verified accounts.
- User creation or transaction failure causes no token or mail call; post-commit token persistence or mail failure does not undo registration/session success and is logged without secrets.
- Unit, real-persistence integration, route, regression, privacy, and focused E2E evidence covers GET non-mutation, POST-body confirmation, token races, invalid-token privacy, delivery failures, migration backfill, and preserved registration/session/checkout behavior.
- The implementation remains provider-agnostic beyond the explicitly local Mailpit/SMTP demo transport.

## Risks and mitigations

| Risk                                                                     |         Likelihood | Mitigation                                                                                                                    |
| ------------------------------------------------------------------------ | -----------------: | ----------------------------------------------------------------------------------------------------------------------------- |
| Registration or checkout regressions                                     |             Medium | Preserve current contracts explicitly and add registration/session/checkout regression coverage before changing consumers     |
| Account enumeration through resend, confirmation page, or invalid tokens | High if mishandled | Generic statuses/bodies, non-mutating page behavior, normalized lookup, and privacy-focused route tests                       |
| Token leakage or link forgery                                            |             Medium | CSPRNG tokens, digest-only persistence, trusted configured origin, sanitized logs, and no plaintext idempotency material      |
| Mail failure creates misleading UX                                       |             Medium | Never claim delivery; keep committed token usable, return the existing registration result, and make resend the recovery path |
| Concurrent resend/confirmation leaves multiple usable tokens             |             Medium | Per-user serialized replacement and atomic confirmation/consumption tests                                                     |
| Local SMTP is mistaken for production readiness                          |             Medium | Keep `MailPort` provider-neutral, label Mailpit as demo-only, and record provider/operations as later decisions               |
| In-memory rate limits do not scale across processes                      | High in production | Accept only for local/single-process demo; defer shared-store and deployment policy decisions explicitly                      |
| Migration/backfill mistakes affect existing accounts                     |    Low/High impact | Reversible migration design, real-database integration tests, and verification of existing-user backfill                      |

## Rollback

Revert the application, browser confirmation page, and route changes if the slice is not acceptable. The migration must provide a safe down path for the new verification/token structures; rollback must not alter the existing registration, session, login, or checkout contracts. The browser GET must remain non-mutating during rollback and normal operation. If delivery behavior is unstable, disable the local mail adapter/configuration and use resend as the recovery path while retaining committed verification state. Any production rollout, provider migration, token cleanup, retention, and operational rollback procedure remain later decisions because no production provider is selected here.

## Later decisions, not silently resolved here

- Production provider, adapter ownership, credentials, domain authentication, sending limits, observability, and delivery-SLA expectations.
- Exact generic error schema and presentation details for the already-binding confirmation-page/resend UX.
- Whether verification state belongs in auth/user DTOs and its public field name.
- Whether rate-limited resend responses remain `202` or become `429`, and which shared store enforces limits in multi-process deployments.
- Cleanup/retention policy for consumed and expired token rows.
- Retry policy after the direct adapter stage: manual resend, bounded inline retry, queue, or transactional outbox.
- Public-origin configuration name and deployment ownership.
- Reconciliation of stale OpenSpec JWT/session statements with the current cookie-based behavior.

## Success criteria

- [ ] The portfolio can be demonstrated locally from registration to Mailpit message to successful confirmation.
- [ ] Current registration, immediate session, login, and checkout behavior is unchanged for both verified and unverified users.
- [ ] Verification state and token lifecycle satisfy the 24-hour, hashed, single-use, one-active-token contract.
- [ ] The confirmation URL opens a non-mutating browser page, whose POST body token drives the atomic confirmation; responses are idempotent or generic as specified and do not enable account enumeration.
- [ ] Delivery is post-commit, provider-agnostic, and explicitly limited to the local Mailpit/SMTP demo transport.
- [ ] Focused automated evidence covers persistence failures, mail failures, races, rate limits, privacy, migration backfill, and regression behavior.
- [ ] No unresolved production provider or operational choice is presented as decided.

## Reference

`docs/diseno/email-confirmation-contract.md` is the existing design memo and contract reference. Future artifacts should refine it without duplicating or contradicting its current-registration, cookie-session, security, failure, and non-goal rules.
