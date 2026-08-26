# Proposal: Concurrency Tests

## Intent

P2 tech debt (#5774). Two concurrent-access behaviors are undocumented and untested:

1. **Cart last-write-wins.** `SequelizeShoppingCartRepository.ts:51-80` destroys all ACTIVE rows then recreates them in one transaction, with no version token. Two overlapping `PUT /api/cart` resolve by commit order, not request order. This is an **already-accepted tradeoff** (`archive/2026-07-30-cart-consistency/proposal.md:20,26`) — we test and document it, we do **not** fix it.
2. **Registration race degrades the error.** `RegisterUserUseCase.ts:22-26` is check-then-insert with no transaction. The DB `UNIQUE KEY email` (`20260724000000-baseline.js:40`) keeps data correct, so the defect is the response: the loser's `SequelizeUniqueConstraintError` reaches `errorHandler.ts:25-32`, which has no branch for it → **500** plus an **orphaned avatar file**, because it bypasses `UserApiController.ts:171-177` (which returns the duplicate message *and* calls `cleanupUploadedFile`).

**Correction to the brief:** the sequential duplicate path returns **400**, not 409 (`UserApiController.ts:175`, asserted at `UserApiController.test.ts:136`). Preserving 400 is the assumption here — see Open Questions.

## Scope

### In Scope
- Real-DB integration test for the cart race, asserting the documented last-write-wins outcome. No cart production code.
- Real-DB integration test: two concurrent registrations, same email → one 201, one duplicate response identical to the sequential path, no orphaned upload.
- Smallest fix making that pass: translate the unique-constraint violation into `UserAlreadyExistsException` so it reuses the existing controller branch.
- Both tests as `*.integration.test.ts` under `jest.integration.config.js`, mirroring `SequelizeProductRepository.integration.test.ts`.

### Out of Scope
- Fixing the cart race; optimistic concurrency (version/ETag).
- Stock decrement — already atomic and already covered by a real-DB concurrency test.
- Migration concurrency — `checkNoPendingMigrations()` is boot-time read-only; no write race.
- Rate limiting — `MemoryStore` is per-process: a scaling limit, not a correctness race. Accepted.
- The 5 redundant `UNIQUE KEY` indexes on `User.email` (observed debt).

## Capabilities

### New Capabilities
- `concurrency-guarantees`: which concurrent behaviors are guaranteed, which are accepted last-write-wins, which are deferred.

### Modified Capabilities
- `user-auth`: a duplicate email losing a race MUST produce the same response as a sequential duplicate, never a 500.

## Approach

Tests are the deliverable; the fix exists only to make an assertion truthful. Prefer translating the driver error **in the repository adapter** (`SequelizeUserRepository.create`) over a shared `errorHandler` branch: it keeps the blast radius on user email instead of silently covering franchise/category uniqueness, and restores file cleanup for free. Placement is an `sdd-design` decision.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/**/__tests__/SequelizeShoppingCartRepository.integration.test.ts` | New | Cart race harness |
| `backend/src/**/__tests__/SequelizeUserRepository.integration.test.ts` | New | Concurrent registration |
| `backend/src/infrastructure/repositories/SequelizeUserRepository.ts` | Modified | Unique-violation → domain exception |
| `backend/src/infrastructure/middlewares/errorHandler.ts` | Alternative | Only if design rejects the adapter |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cart race test is inherently non-deterministic | High | Assert the documented outcome *set*, or inject commit ordering — never one expected value. Design decides. |
| `errorHandler` branch would widen to all unique constraints | Med | Prefer adapter-level translation |
| A plain `.test.ts` would skip the real DB and miss the point | Med | `*.integration.test.ts` only; verify the CI `integration` job runs it |
| Flaky tests erode trust in the gate | Med | Deterministic assertions, no sleeps |

## Deferred Decisions

If cart write-order ever becomes user-visible (checkout), revisit optimistic concurrency — the tradeoff was accepted for a cart with no checkout flow, not forever.

## Rollback Plan

Single revert. No schema, migration, or data change; reverting restores the 500-on-race behavior and removes both tests.

## Dependencies

- Reachable MySQL/MariaDB (`DB_HOST`/`DB_USER`/`DB_PASS`), same as the existing integration suite.

## Success Criteria

- [ ] Concurrent same-email registration: exactly one 201, one duplicate response matching the sequential path, no 500.
- [ ] No orphaned avatar file remains after the losing registration.
- [ ] Cart race test passes repeatedly without flaking and documents last-write-wins.
- [ ] No cart production code changed.
- [ ] `npm run test:integration` green; CI `integration` job exercises both tests.

## Open Questions

1. Keep duplicate email at **400** (today's behavior, assumed here), or correct it to **409** to match `categories`/`franchises`? The frontend reads the body message and ignores status (`auth.service.ts:37-53`), so 409 is safe — but it changes a public contract inside a tests-focused change.
2. If the cart race proves untestable deterministically, is documenting it in the spec without an executable test acceptable?
