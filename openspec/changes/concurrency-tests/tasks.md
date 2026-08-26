# Tasks: Concurrency Tests

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~440-560 (prod ~10-15, test-helper ~60-80, unit test ~25-35, integration tests ~330-410) |
| 400-line budget risk | High |
| Chained PRs recommended | Optional — the two behaviors are independently shippable |
| Suggested split | PR 1 (cart race, test-only) → PR 2 (registration race + prod fix) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — user decision needed |

Decision needed before apply: Yes
Chained PRs recommended: Optional, recommended
400-line budget risk: High

The two integration test files are the bulk of the estimate: the cart barrier test (test-owned transaction, 2 payloads, 5 assertions, plus a second sequential last-write-wins test) and the registration race test (real object graph, `req`/`res` doubles, real temp files, bounded `fs.existsSync` polling) are each substantial per design.md. Splitting along the proposal's two independent behaviors keeps each PR under budget and independently revertable — PR 1 touches no production code at all.

**Verification prerequisite (not DB-independent):** unlike most of this session's other work, `pnpm --filter backend test:integration` requires a reachable real MySQL/MariaDB (`DB_HOST`/`DB_USER`/`DB_PASS`), same as the existing integration suite. The unit-level tasks (helpers compiling, `SequelizeUserRepository.test.ts`, lint, type-check) can be verified without a DB; the two new integration test files cannot be executed/verified without one.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Cart race integration test (test-only, no production diff) | PR 1 | `pnpm --filter backend test:integration -- SequelizeShoppingCartRepository.integration` | Real MySQL/MariaDB via `bootstrapTestDatabase()` | Revert the new cart integration test file + its slice of `testDb.ts` helpers; zero production impact |
| 2 | Registration race fix + test (domain exception, repository translation, unit RED/GREEN, integration test) | PR 2 | `pnpm --filter backend test -- SequelizeUserRepository.test` then `pnpm --filter backend test:integration -- SequelizeUserRepository.integration` | Real MySQL/MariaDB + real temp files (`fs.mkdtempSync`) | Revert `UserAlreadyExistsException.ts`, `SequelizeUserRepository.ts`, the new integration test file, and its slice of `testDb.ts` helpers; restores 500-on-race behavior |

## Phase 1: Test Helpers (foundation for both integration tests)

- [x] 1.1 Modify `backend/src/__tests__/helpers/testDb.ts` — add `seedTestUser(overrides?)` (uniquely-named email/password via `Date.now()`+random suffix, same style as `createTestCategory`/`createTestFranchise`), `deleteTestUser(id)` (mirrors `deleteTestProduct`) — implemented minimally, needed by `seedCartFixture` since `ShoppingCart` has an FK to `User`
- [x] 1.2 Modify `backend/src/__tests__/helpers/testDb.ts` — add `readActiveCartRows(userId)` (reads persisted ACTIVE `ShoppingCart` rows directly via `db.ShoppingCart.findAll`, mirrors `readProductStock`'s bypass-cache intent) and `seedCartFixture()`/`cleanupCartFixture()` (seeds the pre-existing ACTIVE row needed for the barrier, mirrors `seedProductWithDependencies`/`cleanupProductFixture`)

## Phase 2: Registration Fix — Domain Exception (depends on Phase 1 for later integration use, independent of Phase 3-6 sequencing)

- [x] 2.1 Modify `backend/src/domain/exceptions/UserAlreadyExistsException.ts` — add optional `options?: ErrorOptions` param forwarded to `super`; confirm no existing constructor-arity test breaks (single-arg call sites stay valid per design.md's fallback note)

## Phase 3: Registration Fix — Repository Translation (RED)

- [x] 3.1 RED: `backend/src/infrastructure/repositories/SequelizeUserRepository.test.ts` — `create` rejecting with a mocked `UniqueConstraintError` throws `UserAlreadyExistsException` with the byte-identical message `'Este email ya está registrado'`; any other error rethrown unchanged (unmodified pass-through)

## Phase 4: Registration Fix — Repository Translation (GREEN, depends on 2.1, 3.1)

- [x] 4.1 GREEN: `backend/src/infrastructure/repositories/SequelizeUserRepository.ts` — wrap only the existing `db.User.create(...)` call in try/catch; `UniqueConstraintError` → `throw new UserAlreadyExistsException('Este email ya está registrado', { cause: error })`; any other error rethrown unchanged; `findByEmail`/`findById`/`findAll` untouched (exact 6-line diff per design.md)

## Phase 5: Cart Race Integration Test (depends on Phase 1 only — independently shippable, may run in parallel with Phases 2-4)

- [x] 5.1 Create `backend/src/infrastructure/repositories/__tests__/SequelizeShoppingCartRepository.integration.test.ts` — barrier setup: test-owned transaction `T0`, seed one pre-existing ACTIVE row for the fixture user via `seedCartFixture()`, `SELECT ... FOR UPDATE` that row inside `T0`
- [x] 5.2 Same file — race `it`: fire both `syncCart(A)` (2 rows, P1/P2, qty 1/2) and `syncCart(B)` (1 row, P3, qty 7) concurrently via `Promise.allSettled`, await one macrotask so both park on the lock, then commit `T0`
- [x] 5.3 Same file — assert all 5 invariants per design.md: (1) `fulfilled.length >= 1`; (2) every rejection's `parent.code` ∈ `{ER_LOCK_DEADLOCK, ER_LOCK_WAIT_TIMEOUT}`; (3) final ACTIVE rows via `readActiveCartRows(userId)`, compared as an order-insensitive set of `{idProduct, quantity, unitPrice}`, deep-equal exactly A or exactly B; (4) `rows.length === winner.length`; (5) if exactly one call fulfilled, the persisted winner matches that call's payload
- [x] 5.4 Same file — second, zero-flake `it`: sequential `syncCart(A)` then `await` then `syncCart(B)`, assert B wins exactly (documentation-grade last-write-wins assertion, no barrier needed)
- [x] 5.5 Same file — `afterEach`/`afterAll` cleanup via `cleanupCartFixture()`/`deleteTestUser`, mirroring the existing product integration test's teardown pattern

## Phase 6: Registration Race Integration Test (depends on Phases 1, 2, 4)

- [x] 6.1 Create `backend/src/infrastructure/repositories/__tests__/SequelizeUserRepository.integration.test.ts` — set `process.env.JWT_SECRET`/`process.env.COOKIE_SECRET` before constructing the controller (env prerequisite for `setSessionCookies`/`getJwtSecret`/`issueCsrfToken`)
- [x] 6.2 Same file — wire the real object graph: `new UserApiController(authStub, listStub, getStub, new RegisterUserUseCase(new SequelizeUserRepository(), new BcryptPasswordHasher()))`; `res` doubles copy `UserApiController.test.ts:60-66` (`status/json/cookie/clearCookie` as `jest.fn().mockReturnThis()`)
- [x] 6.3 Same file — each `req.file` = `{ filename, path }` pointing at a real file written into `fs.mkdtempSync(path.join(os.tmpdir(), 'm3d-race-'))`; remove the temp dir in `afterAll`
- [x] 6.4 Same file — fire two concurrent `register` calls with the same, previously-unused email (same-email fixture generated once, reused by both requests)
- [x] 6.5 Same file — assert: exactly one `res.status(201)` whose `idUser` matches the single DB row; exactly one `res.status(400)` with `{ error: 'Este email ya está registrado' }`; `next` never called on either call (no 500 path)
- [x] 6.6 Same file — assert `db.User.count({ where: { email } }) === 1`; poll `fs.existsSync` on the loser's temp file on a bounded retry (≤2s, 50ms interval) to confirm it is gone; confirm the winner's temp file still exists

## Phase 7: Verification

- [ ] 7.1 Run `pnpm --filter backend test` — full fast/unit suite green, including the new `SequelizeUserRepository.test.ts` RED→GREEN cases
- [ ] 7.2 Run `pnpm --filter backend test:integration` — **requires a reachable real MySQL/MariaDB** (`DB_HOST`/`DB_USER`/`DB_PASS`); confirm both new integration tests pass repeatedly without flaking (run at least twice for the cart race test to build confidence in the invariant assertions)
- [ ] 7.3 Run `pnpm run lint`
- [ ] 7.4 Run `pnpm run type-check`
- [ ] 7.5 Confirm `SequelizeShoppingCartRepository.integration.test.ts` and `SequelizeUserRepository.integration.test.ts` are matched by `jest.integration.config.js`'s `testMatch: ["**/src/**/*.integration.test.ts", ...]`, excluded from fast `npm test` by `jest.config.js`'s `testPathIgnorePatterns`, and picked up by the CI `integration` job (`.github/workflows/ci.yml:103-108`) — this was already verified as a fact by `sdd-design`; this task re-confirms it post-implementation against the actual new file paths, not re-derives it
- [ ] 7.6 Manually trace proposal's Success Criteria: exactly one 201 + one duplicate response matching the sequential path on concurrent registration; no orphaned avatar file; cart race test passes repeatedly without flaking and documents last-write-wins; no cart production code changed; `npm run test:integration` green and CI `integration` job exercises both tests

Checkbox task count: 20.

Dependency order: Phase 1 first (both integration tests need its helpers). Phase 2 → Phase 3 → Phase 4 form the registration-fix RED/GREEN chain and must run in that order. Phase 5 (cart test) depends only on Phase 1 and may proceed in parallel with Phases 2-4. Phase 6 (registration integration test) depends on Phases 1, 2, and 4 completing first. Phase 7 runs last, after all other phases.
