# Email Confirmation Specification

## Purpose

Define a secure, privacy-preserving email-confirmation vertical slice that is fully demonstrable through local Mailpit-compatible SMTP without changing existing account access or claiming production delivery readiness.

## Requirements

### Requirement: Persisted Verification State

The system MUST define a user as verified exactly when `email_verified_at` is non-null. A newly registered user MUST start with `email_verified_at` null. Verification state MUST NOT be added to public auth or user DTOs until the deferred consumer contract is approved.

#### Scenario: New user starts unverified

- GIVEN a registration succeeds
- WHEN the committed user record is read
- THEN `email_verified_at` MUST be null

#### Scenario: Verification state remains internal

- GIVEN no later DTO consumer decision has been approved
- WHEN registration, login, or user responses are returned
- THEN those responses MUST preserve their existing fields
- AND they MUST NOT expose a newly invented verification field

### Requirement: Secure Confirmation Token Lifecycle

A confirmation token MUST be single-purpose, user-bound, opaque, cryptographically random with at least 128 bits of entropy, and valid for exactly 24 hours from creation. The token store MUST retain a user reference, SHA-256 token digest, expiry, consumed timestamp, and creation timestamp, and MUST NOT persist token plaintext. At most one unconsumed, unexpired token for a user MAY be usable at a time.

#### Scenario: Token is created securely

- GIVEN an eligible unverified user requires a confirmation token
- WHEN a token record is created
- THEN the plaintext token MUST contain at least 128 bits of cryptographic randomness
- AND only its SHA-256 digest MUST be persisted
- AND its expiry MUST be exactly 24 hours after its creation time

#### Scenario: Replacement supersedes the previous token

- GIVEN an unverified user has an active confirmation token
- WHEN a replacement token is committed for that user
- THEN the prior token MUST become unusable atomically with creation of the replacement
- AND only the replacement token MAY confirm the user

#### Scenario: Concurrent replacements preserve one active token

- GIVEN concurrent eligible token-replacement requests for one unverified user
- WHEN their persistence operations complete
- THEN no more than one resulting token MUST remain usable

### Requirement: Atomic and Idempotent Confirmation

The system MUST update `email_verified_at` and consume the matching active token as one atomic state transition. A valid first confirmation MUST return HTTP `204`. A retry with that consumed token for the now-verified user MUST return HTTP `204`. Concurrent confirmation attempts for the same valid token MUST produce one state-changing winner while successful retries observe the same verified result.

#### Scenario: Valid token confirms atomically

- GIVEN an unverified user and that user's active, unexpired token
- WHEN the token is submitted for confirmation
- THEN the user MUST become verified
- AND the token MUST become consumed in the same atomic transition
- AND the response MUST be HTTP `204`

#### Scenario: Consumed token retry is idempotent

- GIVEN a token was consumed while verifying its user
- WHEN that same token is submitted again for the already verified user
- THEN no additional state change MUST occur
- AND the response MUST be HTTP `204`

#### Scenario: Failed atomic transition leaves no partial result

- GIVEN confirmation cannot commit both verification and token consumption
- WHEN the transition fails
- THEN neither partial state change MUST be committed
- AND the request MUST NOT report successful confirmation

### Requirement: Generic Invalid Confirmation Contract

The state-changing confirmation endpoint MUST return one generic HTTP `400` contract for missing, malformed, unknown, expired, or superseded tokens. The exact generic error schema is explicitly deferred and MUST NOT disclose account existence, user identity, or verification state.

#### Scenario: Invalid token classes are indistinguishable

- GIVEN confirmation requests containing respectively a missing, malformed, unknown, expired, or superseded token
- WHEN each request is handled
- THEN each response MUST use HTTP `400`
- AND their externally observable error contract MUST NOT identify the token class or associated account state

### Requirement: Browser GET Is Presentation-Only

`GET /confirm-email?token=<opaque-token>` MUST serve the confirmation page without verifying a user, consuming a token, or exposing account or verification state. Only `POST /api/users/email-confirmation/confirm` MAY change confirmation state, and it MUST receive the opaque token in the request body.

#### Scenario: Opening a confirmation link does not mutate state

- GIVEN an active confirmation token appears in a browser confirmation URL
- WHEN a browser requests that URL with GET
- THEN the system MUST serve the confirmation page
- AND the user MUST remain unverified
- AND the token MUST remain unconsumed

#### Scenario: Page submits confirmation by POST body

- GIVEN the confirmation page holds an opaque token from its URL
- WHEN the user submits confirmation
- THEN the page MUST send the token in the body of `POST /api/users/email-confirmation/confirm`
- AND state mutation MUST occur only through that POST

### Requirement: Private and Rate-Limited Resend

`POST /api/users/email-confirmation/resend` MUST normalize email using the existing registration and login rules. Every syntactically valid request MUST receive the same generic HTTP `202` contract whether its account is absent, verified, or eligible. The system MUST send nothing for absent or verified users. For an eligible unverified user, it MUST replace the active token and initiate at most one delivery after commit.

The local single-process slice MUST enforce at most five accepted resend requests per trusted client IP per hour, three actual sends per normalized account per hour, and a 60-second minimum interval between sends. Whether a limited request returns `202` or `429`, and the shared store for multi-process enforcement, are explicitly deferred and MUST NOT be represented as decided.

#### Scenario: Resend does not enumerate accounts

- GIVEN syntactically valid resend requests for an absent account, a verified account, and an eligible unverified account
- WHEN each request is handled
- THEN each non-limited request MUST receive the same generic HTTP `202` contract
- AND no delivery or token MUST be created for the absent or verified account

#### Scenario: Eligible resend replaces token after persistence

- GIVEN an eligible unverified account outside all send limits
- WHEN a valid resend request is processed
- THEN its previous active token MUST be invalidated as the replacement is committed
- AND delivery MUST be initiated only after that commit

#### Scenario: Local resend limits are enforced

- GIVEN requests are evaluated using the project's trusted client-IP handling in one process
- WHEN an IP exceeds five accepted resend requests in one hour, an account reaches three actual sends in one hour, or fewer than 60 seconds have elapsed since its prior send
- THEN the applicable request or send MUST be limited
- AND no excess delivery MUST occur
- AND the response status MUST follow the later-approved `202` versus `429` decision

### Requirement: Confirmation Attempt Limit

The local single-process slice MUST allow at most 30 confirmation attempts per trusted client IP in any 15-minute window. The shared enforcement mechanism for multi-process deployments is explicitly deferred.

#### Scenario: Excess confirmation attempt is limited

- GIVEN one trusted client IP has made 30 confirmation attempts within 15 minutes
- WHEN another confirmation attempt arrives in that window
- THEN the system MUST reject or defer the attempt without evaluating it as an unrestricted confirmation
- AND it MUST NOT disclose token or account state

### Requirement: Provider-Agnostic Post-Commit Mail Boundary

Application behavior MUST depend only on a `MailPort` confirmation intent containing `to`, an absolute configured-origin confirmation URL, expiry, and a non-secret token-record idempotency key. The URL MUST use a trusted configured public origin and MUST NOT derive its origin from request `Host`, `Origin`, or forwarded headers. The application boundary MUST NOT expose SMTP libraries, Mailpit APIs, provider SDKs, provider message IDs, credentials, or provider retry semantics.

#### Scenario: Mail intent contains only approved data

- GIVEN a confirmation token record has committed
- WHEN the application invokes `MailPort`
- THEN the intent MUST contain only the recipient, absolute confirmation URL, expiry, and non-secret token-record idempotency key
- AND the URL origin MUST come from trusted configuration
- AND the idempotency key MUST NOT contain token plaintext

#### Scenario: Delivery never precedes commit

- GIVEN user or token persistence has not committed
- WHEN registration or resend processing is still in progress or fails
- THEN `MailPort` MUST NOT be invoked

### Requirement: Local Mailpit-Compatible SMTP Demo

The slice MUST provide a local SMTP adapter and environment-based configuration compatible with Mailpit. Adapter acceptance MUST mean only that the configured local transport accepted the send request and MUST NOT be described as inbox delivery or production-provider support. SMTP credentials and configuration MUST come from environment variables and MUST NOT be committed as secrets.

Production-provider selection, production adapter ownership, domain authentication, provider limits, delivery SLAs, queue, outbox, worker, retry policy, and distributed delivery infrastructure are explicitly deferred and MUST remain outside this specification.

#### Scenario: Local adapter accepts confirmation intent

- GIVEN Mailpit-compatible local SMTP is configured
- WHEN `MailPort` receives a valid confirmation intent
- THEN the adapter MUST submit a corresponding message to that local SMTP transport
- AND the result MUST NOT claim production delivery

### Requirement: Post-Commit Failure Semantics and Secret-Safe Logging

A user-creation or enclosing transaction failure MUST leave no confirmation token and MUST cause no mail call. A mail failure after user and token commit MUST NOT roll back registration, its immediate session, or the usable token. Such failure MUST be recorded through structured logging with sanitized outcome categories and internal identifiers where needed; logs MUST omit email by default and MUST never contain token plaintext.

Cleanup and retention of consumed or expired token rows, and any retry behavior beyond manual resend, are explicitly deferred.

#### Scenario: Registration transaction fails

- GIVEN user registration cannot commit
- WHEN the registration operation ends
- THEN no confirmation token MUST remain committed
- AND `MailPort` MUST NOT have been called

#### Scenario: Mail fails after commit

- GIVEN registration, session establishment, and token persistence have committed
- WHEN the local mail adapter fails
- THEN registration and token state MUST remain committed
- AND the existing registration result MUST remain successful
- AND the failure MUST be logged without email or token plaintext

#### Scenario: Secret material is absent from observability

- GIVEN any confirmation or resend outcome
- WHEN logs, metrics, analytics, database rows, idempotency keys, and error bodies are inspected
- THEN token plaintext MUST NOT appear in any of them
