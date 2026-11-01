# Demo sandbox connections — Stage 2 foundation

## What exists

`backend/src/infrastructure/database/DemoSandboxConnections.ts` exports
`createDemoSandboxConnections(configuration)`. It constructs one lazy Sequelize
instance for each operator-configured slot on a shared MySQL server. No network
connection, schema creation, authentication, migration, seed or model registration
runs during construction.

This is **not complete Stage 2 or visitor isolation**. Existing API routes remain on
their current composition because this registry is not wired into the API or Stage 1
leases. Authentication and tokens still use their current connections; scoped catalog,
cart, order, commission-request and user adapters exist but are not route-connected.

## Configuration contract

Supply configuration explicitly through a trusted server-side caller:

- `host` and integer `port` (1–65535) identify the shared MySQL server.
- `controlPlaneDatabase` identifies the lease/control database, which no business
  slot may use.
- `slots` is a nonempty, finite array of `{ slotId, database, username, password }`.
  Each slot ID, database and account must be unique. Database and account duplicate
  checks are case-insensitive to avoid portability-dependent collisions.
- Database names use ASCII letters, numbers and underscores, up to 64 characters;
  usernames use the same character set, up to 32 characters. Slot IDs are nonempty
  without surrounding whitespace. Passwords are required and passed unchanged.
- System schemas and the `root` account are rejected.

The whole configuration is validated before any Sequelize construction. Invalid
configuration throws `Invalid demo sandbox connection configuration`; the message
contains no credentials. There is no environment-variable lookup, URI overload or
fallback to the control, development, test, or production database.

The caller must obtain credentials from a private secret source. Do not send this
configuration to the browser or commit real values. Operator-created accounts must
be restricted to their own databases; syntactic validation cannot establish actual
MySQL grants or detect accounts with administrative privileges under other names.

## Ownership and failure behavior

Call the factory once per application-owned configured pool, not once per request.
`connections.get(slotId)` returns that slot's existing instance. An unknown slot
throws `Demo sandbox connection is not configured` without constructing anything.
Later changes to the input configuration do not add slots or redirect instances.

Each connection has `pool.min = 0`, `pool.max = 1`, SQL logging disabled and automatic
query retries disabled. Connection count is therefore bounded by the configured
slot list **per factory invocation**, not across processes or multiple invocations.
The caller owns shutdown: call and await `connections.get(slotId).close()` for each
configured slot. No request routing, lease authorization, shutdown hooks or
cross-process resource coordination is provided here.

Do not use these connections for remote untrusted transport without adding explicit
verified TLS configuration in a later integration slice; this initial API does not
configure TLS. No service deployment is authorized or implied.

## Explicit models and product repositories

`initializeModelsForConnection(sequelize)` in `backend/src/database/models/registerModels.js`
registers the existing model graph and associations on the supplied connection. It
never imports environment configuration or the default DB singleton and never
constructs another connection. Invalid missing connections throw
`Explicit Sequelize connection is required`. The legacy `initializeModels()` still
constructs its environment-selected connection and delegates to that registration.

`createDemoSandboxProductRepositories(connections)` in
`backend/src/infrastructure/database/DemoSandboxProductRepositories.ts` returns an
internal registry. `get(slotId)` returns a cached `ScopedSequelizeProductRepository`;
`getCategoryRepository(slotId)` returns a cached `ScopedSequelizeCategoryRepository`;
`getFranchiseRepository(slotId)` returns a cached `ScopedSequelizeFranchiseRepository`;
`getShoppingCartRepository(slotId)` returns a cached
`ScopedSequelizeShoppingCartRepository`; `getOrderRepository(slotId)` returns a cached
`ScopedSequelizeOrderRepository`; `getCustomCommissionRequestRepository(slotId)` returns
a cached `ScopedSequelizeCustomCommissionRequestRepository`; `getUserRepository(slotId)`
returns a cached `ScopedSequelizeUserRepository`; `getEmailConfirmationTokenRepository(slotId)`
returns a cached scoped confirmation-token repository. The first access to any of these
repositories registers one model graph per slot. All eight repositories share that
graph regardless of accessor order; later calls do not re-register models. Unknown slots propagate the connection registry's rejection
before registering models. Construct this registry once for a connection pool;
repeated registries on the same Sequelize instance can register models repeatedly
and are not a supported lifecycle.

All product queries, association includes, stock SQL and follow-up reads use the
injected graph. The legacy `new SequelizeProductRepository()` remains a wrapper
using the current default graph. No existing routes use the scoped registry yet.
Shopping-cart, order, commission-request and user scoped persistence is available
internally, but existing routes still construct the legacy repositories. The no-argument
`SequelizeUserRepository` retains the default graph and existing duplicate-email error
and cause. Confirmation-token persistence is scoped internally: transactional operations
require an active context from the same connection and lock the user first. The legacy
no-argument adapter still accepts raw Sequelize transaction handles. Neither adapter is
wired to sandbox authentication or routing; refresh tokens, lease binding and session
revocation remain separate work. Verification is mock-only.

Category CRUD uses only its injected Category model. The no-argument
`new SequelizeCategoryRepository()` remains a default-graph wrapper, retaining
existing results, duplicate-name conflicts and foreign-key error translation.
Neither the scoped adapter nor registry imports the default DB at runtime. Current
category routes still use the legacy wrapper; this cut does not switch them to
sandbox persistence or authorize a lease.

Franchise CRUD similarly uses only the injected Franchise model, without runtime
imports of the default DB. The no-argument `new SequelizeFranchiseRepository()`
remains compatible, including `DUPLICATE_FRANCHISE_NAME` conflicts and the
`Franchise has associated products` foreign-key error with its original cause.
Existing franchise routes still use that default-graph wrapper.

Shopping-cart operations use the injected `ShoppingCart` and `Product` models. The
no-argument `new SequelizeShoppingCartRepository()` remains a wrapper around the
default graph. `syncCart` owns a transaction on its injected connection, preserving its
replace-and-create behavior and rollback on failure. Checkout reads lock only active
cart rows, then read product details separately; `markOrdered` remains a pure scoped
UPDATE. Both checkout methods accept only an active transaction context owned by the
same connection and reject unknown, expired, or foreign contexts before persistence
calls. Existing cart routes still use the legacy wrapper; this slice does not wire them
to a slot or authorize a lease. Cart verification is mock-only, not new real-MySQL
evidence.

Order persistence uses only the injected `Order` and `OrderItem` models. The no-argument
`new SequelizeOrderRepository()` remains a wrapper around the default graph.
`createWithItems` requires an active transaction context owned by the same connection;
order creation, item creation and the follow-up read use that context. Unique
idempotency-key violations still map to `DuplicateIdempotencyKeyException`.
`transitionStatus` retains its standalone no-context path and, when given a context,
accepts only one active for the same connection. Its guarded status update, reserved-word
quoting and affected-row result are unchanged. `findAll` retains its newest-first cap of
100; buyer pagination keeps eager-loaded items and `distinct: true`; payment-reference
updates use the injected Order model. Existing order routes still use the legacy wrapper;
this cut does not wire them to a slot or authorize a lease. Order verification is
mock-only, not new real-MySQL evidence.

Commission requests belong to their slot, alongside its catalog products. The injected
`CustomCommissionRequest` model handles creation, active listing (`expiresAt > now`,
newest first), and expiry deletion (`expiresAt <= now`), preserving the deleted count.
A selected-product foreign-key failure retains its domain-error translation; other
errors propagate unchanged. The no-argument `SequelizeCustomCommissionRequestRepository`
remains a default-graph wrapper. Neither the API routes nor the retention scheduler
use the scoped registry yet; this does not schedule per-slot deletion or implement
reset. This port has no transaction-context argument and is not implicitly enlisted
in the UoW. Verification is mock-only, not real-MySQL or visitor-isolation evidence.

The category and franchise ports have no transaction-context argument. Their
operations are not automatically enlisted in a slot UoW; do not assume that merely
calling them inside its callback creates a cross-repository transaction. Category
and franchise coverage is mock-only, not new real-MySQL evidence. The separate
opt-in product MySQL verification below does not prove category/franchise CRUD or
completed visitor isolation.
Playwright configuration, fixtures and worker counts remain unchanged.

### Connection-owned managed transactions

`registry.getUnitOfWork(slotId)` caches a `ScopedSequelizeUnitOfWork` using the
same explicit connection as that slot's product repository. It does not register
models or open a transaction until `runInTransaction(work)` is called. Unknown
slots retain the connection registry's rejection. The legacy
`new SequelizeUnitOfWork()` still uses the default connection.

Within the managed callback, `adjustStock(id, delta, tx)` accepts only an active
context issued for its own connection. Foreign, unknown and completed contexts
throw `Transaction context is not active for this connection` before stock SQL
or follow-up reads. An infrastructure-owned identity registry tracks ownership;
no public/undocumented Sequelize property or user-supplied owner field is trusted.
Contexts are revoked when the callback settles, on both success and failure.
Without `tx`, stock adjustment retains its standalone behavior. Invalid deltas
retain their existing rejection before context resolution.

Sequelize still owns commit/rollback. Callback return values and errors propagate
unchanged; these adapters do not manually commit or roll back. Await all operations
inside the callback; detached work is unsupported. This ownership check is not
lease authorization and does not guard other repository adapters. It does not
prevent mixing a slot UoW with legacy wrappers or other still-global persistence.
Business flows must compose all required adapters for the same slot explicitly.

These APIs register models only: they do not create tables, migrate, seed, verify
lease ownership or prove real MySQL isolation. The connection caller retains
shutdown ownership.

## Opt-in disposable MySQL verification

`pnpm --filter backend test:sandbox:mysql` runs `jest.sandbox.config.js` and
`DemoSandboxProductRepositories.mysql.ts`. The file deliberately does not match
ordinary fast or real-DB test patterns: their scope is unchanged. Missing sandbox
configuration fails before opening a connection; the suite never silently skips.
With already installed tools, the equivalent command from `backend/` is:

```sh
node node_modules/jest/bin/jest.js --config jest.sandbox.config.js --runInBand --detectOpenHandles
```

This suite is destructive **only within a separately authorized, new disposable
server**. Its setup creates three fresh schemas and two accounts; existing schemas
cause setup to fail rather than being dropped or reused. Do not point it at the
normal development, integration or production server. Do not use the shared
`testDb` helper or load `.env`.

Supply these variables explicitly through a trusted operator process:

| Variable                                                      | Required value                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `M3D_SANDBOX_TEST_AUTHORIZATION`                              | `m3d-sandbox-isolation-01a10377`                             |
| `M3D_SANDBOX_TEST_HOST` / `M3D_SANDBOX_TEST_PORT`             | `127.0.0.1` / `33316`                                        |
| `M3D_SANDBOX_TEST_DATABASE_A` / `M3D_SANDBOX_TEST_DATABASE_B` | `m3d_sandbox_verify_a` / `m3d_sandbox_verify_b`              |
| `M3D_SANDBOX_TEST_CONTROL_DATABASE`                           | `m3d_sandbox_verify_control`                                 |
| `M3D_SANDBOX_TEST_SERVER_UUID`                                | UUID read inside the new, operator-owned container           |
| `M3D_SANDBOX_TEST_ADMIN_PASSWORD`                             | Fresh setup-only root password                               |
| `M3D_SANDBOX_TEST_PASSWORD_A` / `M3D_SANDBOX_TEST_PASSWORD_B` | Distinct fresh passwords for `m3d_verify_a` / `m3d_verify_b` |

Each password must be a distinct 64-character lowercase hexadecimal value. Never
commit or print these values. The authorization marker is a local safety opt-in,
not authentication or permission to access an existing server. The suite verifies
the expected server UUID before DDL. The caller must also verify Docker ownership,
image identity and loopback port binding; environment strings alone do not do so.

Setup uses the existing Category/Franchise/Product model definitions, not the full
migration chain. Restricted accounts receive SELECT/INSERT/UPDATE/DELETE on their
own schema only; business assertions use the scoped product registry and UoW.
Checks cover persisted slot separation with equal product IDs, MySQL access-denied
errors for cross-slot/control reads and writes with unchanged rows and counters,
and both rollback and commit of stock adjustments. All opened Sequelize
connections are closed, including after partial setup failure. The operator owns
container cleanup by its recorded ID; data must be ephemeral and existing services
and volumes must remain untouched.

This verifies only that fixture's product persistence and grants. It does not
prove migrations, reset (no concrete adapter yet), TLS, lease/session routing,
other repositories or visitor safety. Record an actual execution and successful
cleanup before claiming this evidence.

## What must happen before visitors use it

1. Complete per-slot repository and unit-of-work injection and integrate explicit
   composition instead of the global singleton, while keeping the lease control plane separate.
2. Bind every business operation to a backend-validated active lease, including
   auth/session tokens, carts, orders and staff commission access.
3. Build explicit per-slot migration, fictitious seed, reset and verification
   adapters, respecting the operator-mediated reset fencing contract.
4. Confirm the exact disposable MySQL host/databases before DB tests; independently
   verify grants, transactions, rollback and isolation. Mock tests do not prove any
   of those properties.

No database provisioning command or administrative runtime privilege is introduced
by this module.
