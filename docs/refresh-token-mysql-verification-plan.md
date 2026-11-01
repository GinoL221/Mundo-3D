# Refresh-token MySQL verification — preparation

This is a proposed procedure, not permission to run it. No existing container,
volume, network, database or account may be reused, stopped or deleted.

## Required safety gates

1. Agree on one run-specific container name, volume name and loopback port before
   provisioning. Verify the names are absent and the port is available; abort on
   collision. Use the already available, explicitly pinned MySQL image only.
2. Generate distinct temporary credentials without committing them, writing them
   into shared files, or exposing them in command output. Do not read `.env`.
3. Create only the authorized container and volume. Record the exact container ID,
   volume name and ownership labels immediately. A volume name can be reused and
   is not an immutable container ID. Confirm the loopback port mapping, image ID,
   mounts, container ID and MySQL server UUID before any schema operation. Abort
   if the endpoint or ownership cannot be verified. Never use fallback hosts.
4. In that identified instance only, create fresh A, B and control schemas and
   distinct slot accounts restricted to their respective schemas. Confirm effective
   account identity and cross-schema denial; seed a control sentinel and record
   baseline contents and counters. DDL or account-creation errors must not reveal
   passwords.
5. Run only the dedicated opt-in suite using explicit configuration and no default
   database singleton or dotenv. Include two independent connections for the same
   slot when exercising simultaneous claims: the standard slot connection has a
   pool maximum of one. Check one winning claim, same-family successor state,
   rollback, cross-connection transaction rejection without mutation, cross-schema
   denial, and unchanged B and control snapshots. Assert all asynchronous outcomes.
6. On success, failure or interruption, close owned connections, preserve redacted
   evidence and clean up only after revalidating the container ID, volume name
   and ownership labels.
   Confirm the container and its volume are absent afterward. If ownership or
   cleanup is uncertain, stop and report the remaining resources; do not fall back
   to broad cleanup. No deletion is authorized merely by this document.

## Scope and prerequisites

The existing `DemoSandboxProductRepositories.mysql.ts` is tied to a previously
used disposable identity and covers products, not this refresh-token slice. It is
not authorization for a new run. A dedicated fail-closed suite and its offline
safety verification must be completed before requesting authorization for a
specific execution. No real-MySQL result or visitor isolation is established by
this plan. Routing, lease binding, JWT invalidation and reset remain outside the
proposed test.

## Supervised run sheet (not yet executable)

The operator, not the test, owns provisioning and deletion. Before requesting
permission, prepare a run record with the proposed unique container and volume
names, pinned image ID, loopback port, A/B/control schema and account names, and
intended exact operations. Do not reuse an existing resource. Obtain separate
specific authorization for creation, MySQL access and eventual deletion; this
plan grants none. Credentials must never appear in the record or command output.

After authorized creation, independently inspect the container's immutable ID,
image ID, ownership labels, running state, exact volume name and mount, and
loopback-only port mapping. From inside that exact container, independently obtain
its MySQL server UUID and compare it with the endpoint reached over the recorded
port. Verify the volume is not shared or attached elsewhere. A name, environment
variable, or UUID supplied to the test is not evidence of ownership. Stop before
schema or fixture writes if any identity, attachment or mapping differs or cannot
be verified; preserve redacted observations for review.

Only after identity is established and schema/account setup is separately
approved, the operator creates fresh schemas and distinct least-privilege A, B
and control accounts. Verify `CURRENT_USER()` and `DATABASE()` on each session;
verify A and B cannot read or write each other's schema or control, and compare
all detached rows and allocator counters around denied attempts. Record the
control sentinel and baseline before fixture mutation. Do not use a root account
for slot operations. Errors must not disclose credentials.

A future reviewed fixture must hold two distinct A physical sessions
simultaneously and demonstrate that all associated repository reads, writes and
UoW transactions remain on those specific sessions, not merely on matching
Sequelize wrappers. Verify same server/schema and distinct connection IDs while
held; prove no reconnect or pool reacquisition can substitute another session.
Then perform foreign-transaction rejection with unchanged snapshots, deliberate
rollback, and simultaneous claims with exactly one committed successor and one
rolled-back loser; compare B and control after each step. A timeout or unknown
transaction outcome is a failed run, not a successful cleanup signal.

On interruption or failure, stop test activity and close only connections owned by
the run when safe. Preserve redacted evidence and report any uncertain ongoing
transaction or resource. Deletion requires a separate decision and authorization:
the operator must recheck the immutable container ID, volume name, labels, mounts
and other attachments immediately before deleting only those exact resources. A
volume name alone does not prove continuity or ownership after replacement; if
identity is uncertain, do not delete. Then
verify absence. If any check is uncertain, leave resources untouched and report
identities; never use broad cleanup. No Docker lifecycle is automated here.

## Offline fixture status and remaining proof

`backend/jest.refresh-sandbox.config.js` selects only the dedicated
`RefreshTokenSandboxIsolation.mysql.ts` entry point. That entry point deliberately
fails via the disabled fixture; it is a safety sentinel, not an integration test
or permission to connect. Ordinary Jest discovery does not select its `.mysql.ts`
name. Do not run it against resources until the missing proof below is resolved.

`refreshTokenIsolationFixture.ts` has been hardened offline with configurable
acquisition timeouts (`acquisitionTimeoutMs`, defaulting to 5000 ms) and a decoupled
race lifecycle that allows the winning claim to commit independently without
causing deadlocks with the loser. 31 mock-based tests verify these behaviors offline.
However, `runRefreshTokenMysqlFixture` remains deliberately disabled: it rejects
before calling any supplied callback or constructing a connection. The scenario
runner still relies on injected inputs, not live verified MySQL sessions.

Before implementing an operational fixture or presenting concrete resource names for authorization,
establish and independently review:

- An authorized creation chain and independently observed container, mount,
  image and loopback endpoint identity, including an internal server UUID
  obtained from the exact owned instance rather than a caller's expected value.
- Two simultaneously held, distinct physical connections to the same owned
  server and schema; prove every repository operation and transaction uses the
  verified physical connection throughout, including pool acquisition,
  reconnect, transaction lifecycle and failure paths. Wrapper identity and
  before/after identity probes alone are insufficient.
- Restricted A/B/control accounts, cross-schema denial, detached snapshots and
  seed ownership, and a separate runner authorization gate before any connect
  or write. The fixture must not create or connect to resources by itself.
- Bounded failure handling for a transaction acquisition that never settles (now covered
  offline by configurable acquisition timeouts and late-entry rejection).
- An ownership-safe cleanup protocol with separate deletion authorization.

No opt-in MySQL execution, fixture seeding, resource provisioning or cleanup is
currently authorized or demonstrated. Mock results do not close these gaps.

