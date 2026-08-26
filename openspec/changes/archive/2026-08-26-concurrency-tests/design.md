# Design: Concurrency Tests

## Technical Approach

Two real-DB integration tests at the repository/adapter layer, mirroring `SequelizeProductRepository.integration.test.ts` (real `db`, `bootstrapTestDatabase()`, `Promise.allSettled`, no sleeps). The only production change is a 6-line unique-violation translation in `SequelizeUserRepository.create`, copied verbatim from the pattern already in `SequelizeCategoryRepository.create:30-35`. **No cart production code.** Open Question 1 is resolved: duplicate email stays **400**.

## Load-Bearing DB Facts (verified, not assumed)

| Fact | Source | Consequence |
|---|---|---|
| `ShoppingCart` has `KEY id_user` | baseline:113 | `syncCart`'s DELETE takes an *index-range* lock scoped to one user → tests isolate, and the two transactions serialize instead of interleaving row-by-row |
| `syncCart` = DELETE-then-INSERT in one tx, no version token | `SequelizeShoppingCartRepository.ts:51-80` | The loser blocks on the winner's locks, then re-DELETEs the winner's rows. InnoDB **cannot** produce a merged cart |
| InnoDB deadlock detection is immediate, not timeout-based | MySQL/InnoDB | A contended run fails fast (`ER_LOCK_DEADLOCK`) — never hangs past jest's 30s cap |
| `User`'s only unique indexes are `email`..`email_5`, all on `email` | baseline:40-44, `User.js:26` | Any `UniqueConstraintError` from `db.User.create` **is** an email collision — no field discrimination needed or possible |
| `User` has no Role FK (`id_role` default 2) | baseline:37 | User fixtures need no seeding beyond the row itself |

## Architecture Decisions

### Decision: Cart race — invariant assertions + a test-owned lock barrier

| Option | Tradeoff | Verdict |
|---|---|---|
| Fire two `syncCart` calls and hope they overlap | Zero cost, but a run where A finishes before B starts tests nothing | Rejected alone |
| Inject commit ordering via a test-only seam in `syncCart` | Deterministic, but violates the proposal's "No cart production code changed" and asserts the seam, not InnoDB | Rejected |
| **Test-owned barrier + invariant assertions** | Forces genuine contention using only public Sequelize APIs; assertions stay valid even if a run does not overlap | **Chosen** |

**Barrier** (in the test, zero production impact): open the test's own transaction `T0`, seed one pre-existing ACTIVE row for the fixture user, `SELECT ... FOR UPDATE` that row inside `T0`, fire both `syncCart` calls, await one macrotask so both park on the lock, then commit `T0` — releasing both to contend for real.

**Payloads**: A = 2 rows (products P1,P2 / qty 1,2), B = 1 row (product P3 / qty 7). Disjoint ids and different cardinality make a union (3 rows) or any partial mix structurally distinguishable from either winner.

**Assertions** — all hold whether or not a given run truly overlapped:

1. `fulfilled.length >= 1` — a race never loses both writes.
2. Every rejection is a concurrency error: `parent.code` ∈ {`ER_LOCK_DEADLOCK`, `ER_LOCK_WAIT_TIMEOUT`} — never validation, FK, or connection failure.
3. Final ACTIVE rows for the user, compared as an order-insensitive set of `{idProduct, quantity, unitPrice}`, deep-equal **exactly A** or **exactly B** — the seeded pre-existing row is gone, no union, no mix, never empty.
4. `rows.length === winner.length` — no leftovers or duplicates.
5. If exactly one call fulfilled, the persisted winner **must** be that call's payload (fully deterministic sub-case).

A second, zero-flake `it` runs `syncCart(A)` then `await` then `syncCart(B)` and asserts B wins exactly — this is the documentation-grade *last-write-wins* assertion. The race `it` proves only *no corruption*; together they cover the capability without a single flaky expectation.

### Decision: Translate `UniqueConstraintError` in `SequelizeUserRepository.create`

```ts
import { UniqueConstraintError } from 'sequelize';
// ...inside create(), wrapping ONLY the existing db.User.create(...) call:
} catch (error) {
  if (error instanceof UniqueConstraintError) {
    throw new UserAlreadyExistsException('Este email ya está registrado', { cause: error });
  }
  throw error;
}
```

- **Message is byte-identical** to `RegisterUserUseCase.ts:25`, so the race loser's body matches the sequential duplicate exactly.
- **No field matching.** MySQL reports whichever of `email`..`email_5` fired, so Sequelize's `path` is not reliably `'email'`; and the table has no other unique index. Matching on the field name would be fragile with zero added safety.
- **Purely additive**: the `try` body is unchanged; the sequential duplicate path returns from `RegisterUserUseCase:24-26` before `create()` is reached, so it never enters the catch. `findByEmail`, `findById`, `findAll` untouched.
- Supporting 1-line change: `UserAlreadyExistsException` gains an optional `options?: ErrorOptions` forwarded to `super`, preserving the project's `{ cause }` convention. Backward compatible (existing single-arg call sites and tests unaffected). *If a constructor-arity test blocks this, drop the `cause` and keep the single-arg form — the behavior under test is unchanged.*
- **Rejected**: an `errorHandler.ts` branch — it would silently cover franchise/category/token uniqueness and would return 400 **without** calling `cleanupUploadedFile`, leaving the orphan the proposal exists to kill.

### Decision: Registration test granularity — real object graph, hand-built `req`/`res`

| Option | Tradeoff | Verdict |
|---|---|---|
| Repository-only (2× concurrent `create`) | Proves the translation, proves neither the 400 body nor the file cleanup | Rejected |
| supertest through the real Express app | Drags multer, multipart, CORS and CSRF into a repository suite; slower, no extra proof | Rejected |
| **Real `SequelizeUserRepository` → `RegisterUserUseCase` → `UserApiController.register`, invoked with `req`/`res` doubles** | Real DB, real race, real `fs.unlink`, real status/body; orphan absence asserted on the actual filesystem | **Chosen** |

Wiring: `new UserApiController(authStub, listStub, getStub, new RegisterUserUseCase(new SequelizeUserRepository(), new BcryptPasswordHasher()))`. `res` doubles copy `UserApiController.test.ts:60-66` (`status/json/cookie/clearCookie` as `jest.fn().mockReturnThis()`). Each `req.file` = `{ filename, path }` pointing at a **real** file written into `fs.mkdtempSync(path.join(os.tmpdir(), 'm3d-race-'))`, removed in `afterAll`.

The race is reliable without a barrier: both `findByEmail` calls miss within milliseconds, then each awaits bcrypt (~100 ms) before `create()` — the window is wide by construction.

**Assertions**: exactly one `res.status(201)` whose `idUser` matches the single DB row; exactly one `res.status(400)` with `{ error: 'Este email ya está registrado' }`; `next` never called on either (no 500 path); `db.User.count({ where: { email } }) === 1`; the loser's temp file is **gone** from disk; the winner's temp file still exists. Because `cleanupUploadedFile` is fire-and-forget `fs.unlink` (never awaited), poll `fs.existsSync` on a bounded retry (≤2 s, 50 ms interval) instead of a fixed sleep.

**Env prerequisite**: the 201 path calls `setSessionCookies` → `getJwtSecret()` and `issueCsrfToken()`. The test must set `process.env.JWT_SECRET` and `process.env.COOKIE_SECRET` before constructing the controller, or the winner throws and the test misreads the race.

## Data Flow

```
CART RACE
  test T0 ──BEGIN; SELECT seeded row FOR UPDATE──┐  (barrier held)
      syncCart(A)  BEGIN; DELETE ...──blocked────┤
      syncCart(B)  BEGIN; DELETE ...──blocked────┤
  test T0 ──COMMIT──────────────────────────────→┘  both released, contend
                                │
        ┌───────────────────────┴─────────────────────────┐
   one commits last                          or  one rolls back (ER_LOCK_DEADLOCK)
   final rows == exactly A or exactly B       final rows == the survivor's payload
   (assertions 1-4)                           (assertion 5, deterministic)

REGISTRATION RACE
  register(req1) ─ findByEmail→null ─ bcrypt ─ create ─┐
  register(req2) ─ findByEmail→null ─ bcrypt ─ create ─┤
                                                       │
                          winner ──→ 201 + cookies, temp file kept
                          loser  ──→ UniqueConstraintError
                                       │ (NEW: SequelizeUserRepository.create)
                                  UserAlreadyExistsException
                                       │ (EXISTING: UserApiController:171-177)
                                  cleanupUploadedFile(path) + 400 { error }
                                       └─ next() never called → no 500
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/infrastructure/repositories/SequelizeUserRepository.ts` | Modify | try/catch around `db.User.create` → `UserAlreadyExistsException` |
| `backend/src/domain/exceptions/UserAlreadyExistsException.ts` | Modify | Optional `options?: ErrorOptions` forwarded to `super` |
| `backend/src/infrastructure/repositories/__tests__/SequelizeShoppingCartRepository.integration.test.ts` | Create | Barrier race + sequential last-write-wins |
| `backend/src/infrastructure/repositories/__tests__/SequelizeUserRepository.integration.test.ts` | Create | Concurrent registration + orphan-file assertion |
| `backend/src/__tests__/helpers/testDb.ts` | Modify | Add `seedTestUser()`, `readActiveCartRows(userId)`, `deleteTestUser(id)`, `seedCartFixture()`/`cleanupCartFixture()` — same style as the existing product helpers |
| `backend/src/infrastructure/repositories/__tests__/SequelizeUserRepository.test.ts` | Modify | Mock-level RED test: `create` rejecting with `UniqueConstraintError` → `UserAlreadyExistsException`; any other error rethrown unchanged |

## Test File Locations & CI Pickup (verified)

Both new files sit in the **same directory as the reference test** (`backend/src/infrastructure/repositories/__tests__/`) and use the `*.integration.test.ts` suffix, therefore:

- Matched by `jest.integration.config.js` `testMatch: ["**/src/**/*.integration.test.ts", ...]` ✓
- Excluded from fast `npm test` by `jest.config.js` `testPathIgnorePatterns: ['\\.integration\\.test\\.(ts|js)$']` ✓
- Run in CI by `.github/workflows/ci.yml:103-108` (`integration` job → `pnpm run test:integration`, MySQL 8.0 service, `DB_HOST=127.0.0.1`) ✓
- `integration` is a required check via `verification-gate` (`ci.yml:180,190`) ✓

The suite uses `bootstrapTestDatabase()` → `ensureDatabaseExists('test')` + `sequelize.sync({ force: false })`. Because `User.js` declares `unique: true` on `email`, `sync` creates the UNIQUE index, so the race is enforced by the real DB in CI exactly as in production.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `SequelizeUserRepository.create` maps `UniqueConstraintError` → `UserAlreadyExistsException`; other errors rethrown | Existing mocked `SequelizeUserRepository.test.ts` |
| Unit | 400 + `cleanupUploadedFile` on `UserAlreadyExistsException` | **Already covered** — `UserApiController.test.ts:121-142`, unchanged |
| Integration | Cart: no-corruption invariants under forced contention | Barrier + `Promise.allSettled` |
| Integration | Cart: sequential last-write-wins | Deterministic, documents the accepted tradeoff |
| Integration | Registration: 1×201, 1×400 with the exact sequential body, no `next()`, 1 DB row, no orphan file | Real graph + `req`/`res` doubles + real temp files |
| E2E | N/A | No user-facing flow changes |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The change adds tests plus one in-process error translation; no HTTP contract, route, or status code changes.

## Migration / Rollout

No migration. No schema, data, env, or config change. Single-revert rollback restores the 500-on-race behavior and removes both tests.

## Open Questions

- [ ] **Lock-wait vs. jest timeout (risk, mitigated by design).** `innodb_lock_wait_timeout` defaults to 50 s, above jest's 30 s cap. The barrier holds `T0` for microseconds and deadlocks are detected immediately, so this should never fire. **Default if it ever flakes**: add `--innodb-lock-wait-timeout=5` to the CI MySQL service args rather than weakening any assertion.
- [ ] **`{ cause }` on `UserAlreadyExistsException`.** Recommended default is the optional-`ErrorOptions` param; fall back to the single-arg form if an existing constructor test asserts arity.
- [ ] **Sequelize pool.** `config.js` sets no `pool`, so the default `max: 5` applies. The barrier test needs 3 concurrent connections (T0 + 2). Fine today; if a future test raises concurrency, set `pool.max` explicitly in the `test` config.
- [ ] Proposal Open Question 2 is **moot**: the cart race is testable — the invariant assertions above are executable and non-flaky, so no spec-only documentation fallback is needed.
