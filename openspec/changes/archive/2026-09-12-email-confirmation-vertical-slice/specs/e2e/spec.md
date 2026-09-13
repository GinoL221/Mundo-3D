# Delta for E2E Testing

## ADDED Requirements

### Requirement: Email Confirmation Vertical-Slice Evidence

Automated evidence MUST cover the email-confirmation slice at unit, real-persistence integration, route/privacy, regression, and focused browser E2E levels. The evidence MUST distinguish local SMTP adapter acceptance from production delivery and MUST NOT claim production-provider, queue, outbox, worker, or access-gating coverage.

#### Scenario: Unit evidence covers token and orchestration rules

- GIVEN the unit suite exercises email-confirmation behavior
- WHEN it runs
- THEN it MUST cover at least 128-bit cryptographic token generation, SHA-256 digest-only persistence intent, exact 24-hour expiry, one-active-token replacement, email normalization, trusted configured-origin URL construction, and post-commit mail orchestration
- AND it MUST cover persistence and mail failure semantics without token plaintext in observable output

#### Scenario: Real-persistence evidence covers state and races

- GIVEN the real-database integration suite executes against the supported database
- WHEN migration, resend, and confirmation cases run
- THEN it MUST prove existing-user backfill and new-user null verification state
- AND it MUST prove atomic verify-and-consume, one usable replacement token, superseded-token rejection, and concurrent confirmation with one state-changing winner and idempotent successful retry

#### Scenario: Route evidence covers privacy and method semantics

- GIVEN route tests exercise confirmation and resend endpoints
- WHEN the tests run
- THEN they MUST prove `GET /confirm-email` does not mutate verification or token state
- AND they MUST prove confirmation accepts the token from the POST body and returns `204` for valid and idempotently repeated confirmation
- AND they MUST prove missing, malformed, unknown, expired, and superseded tokens share the generic HTTP `400` contract
- AND they MUST prove syntactically valid resend requests for absent, verified, and eligible accounts share the generic HTTP `202` contract when not limited
- AND they MUST cover the configured per-IP, per-account, interval, and confirmation-attempt limits without asserting the deferred `202` versus `429` choice for limited resend responses

#### Scenario: Registration and access regressions are prevented

- GIVEN regression tests cover a newly registered unverified user
- WHEN registration and existing account flows execute
- THEN registration MUST still require multipart image input, return the existing HTTP `201` body, establish the immediate cookie session, and preserve redirect behavior
- AND login, cart, account, roles, and checkout MUST remain available under their existing rules

#### Scenario: Focused browser flow is locally demonstrable

- GIVEN the application and Mailpit-compatible local SMTP demo are running
- WHEN a user registers, opens the resulting confirmation message, visits its link, and submits the confirmation page
- THEN registration MUST leave the browser authenticated
- AND link navigation MUST not verify the user before submission
- AND submission MUST verify the user through the POST-body flow
- AND the evidence MUST describe mail only as accepted by the local adapter

#### Scenario: Failure evidence preserves committed outcomes

- GIVEN tests induce user or token transaction failure and post-commit mail failure
- WHEN those failures occur
- THEN transaction failure MUST leave no token and cause no mail call
- AND mail failure MUST leave registration, session, and token state committed
- AND captured logs and responses MUST contain neither token plaintext nor account-disclosing confirmation details
