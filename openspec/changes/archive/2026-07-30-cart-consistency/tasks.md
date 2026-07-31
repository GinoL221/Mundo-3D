# Tasks: Cart Consistency

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~170-250 (prod ~50, tests ~120-190) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Correction to proposal's ~250-320 estimate: design's final shape (one static assertion, one Map merge with an inline validation guard in the use case, one constant swap) is tighter than proposal assumed. Confirmed Low, not Medium.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Full cart-consistency fix (single cohesive unit per design) | PR 1 | `pnpm --filter backend test src/application/__tests__ src/infrastructure/repositories/__tests__ src/infrastructure/middlewares/__tests__/validators` | N/A — no live-DB harness exists for cart; design explicitly scoped one out | Revert the 3 modified source files + 4 modified test files; no migration, no data backfill |

## Phase 1: Domain — Ceiling Constant and Static Assertion

- [x] 1.1 RED: `ShoppingCart.test.ts` — quantity 99 succeeds, 100 throws (was 10/11); add direct `ShoppingCart.assertValidQuantity` cases (valid, non-integer, ≤0, >99).
- [x] 1.2 GREEN: `ShoppingCart.ts` — export `MAX_CART_ITEM_QUANTITY = 99`; add `static assertValidQuantity(quantity)` with the three existing checks (integer, >0, ≤MAX); constructor body becomes `ShoppingCart.assertValidQuantity(quantity)`.

## Phase 2: Use Case — Duplicate Merge and Write-Path Validation Guard (depends on 1.2)

- [x] 2.1 RED: `SyncCartUseCase.test.ts` — two items with same `productId` (20+15) merge into one `syncCart` entry with `quantity: 35`; the two existing tests (order, missing-product-drop) stay byte-identical.
- [x] 2.2 RED: `SyncCartUseCase.test.ts` — duplicates summing to 120 (incl. a nonexistent `productId`) throw `CartValidationException`; `cartRepo.syncCart` is never called.
- [x] 2.3 RED: `SyncCartUseCase.test.ts` — a single, non-duplicate item with quantity 100 throws `CartValidationException` before persistence; `cartRepo.syncCart` is never called. This is the write-path invariant guard (closes the gap where invalid quantities could otherwise reach the repository), now exercised at the use-case boundary instead of the repository.
- [x] 2.4 GREEN: `SyncCartUseCase.ts` — add private `mergeItems(items): Map<number, number>` (insertion-ordered, sums by `productId`); in `execute`, merge first, call `ShoppingCart.assertValidQuantity` per merged sum (this single call satisfies both the merge-overflow case and the general write-path guard), **then** run existing `findById`/drop-missing loop over the merged entries, **then** call `cartRepo.syncCart` with the validated entries.

## Phase 3: Validator — Constant Wiring (depends on 1.2)

- [x] 3.1 GREEN: `cartValidators.ts` — import `MAX_CART_ITEM_QUANTITY` from `ShoppingCart.ts`; replace literal `max: 99` and the `1 and 99` message text with the constant (behavior-preserving, numeric no-op).
- [x] 3.2 Run existing `cartValidators.test.ts` unmodified — confirm 99 still passes and 100 still rejects against the constant; no new cases needed.

## Phase 4: Repository — Round-Trip Regression, No Validation Added (depends on 1.2)

- [x] 4.1 RED→GREEN: `SequelizeShoppingCartRepository.test.ts` — split-brain regression: capture the object passed to `db.ShoppingCart.create` for quantity 99, feed it back through the `findAll` mock into `findByUserId`, assert `toEntity()` does not throw and `quantity === 99`. This fails RED before Phase 1 raises the ceiling and passes GREEN once Phase 1 lands, with **no production code change to the repository** — it stays a pure persistence adapter (see design.md Decision 1); no validation-rejection test is added here.

## Phase 5: Verification

- [x] 5.1 Run `pnpm --filter backend test` — full suite green; confirm no regression in `SyncCartUseCase.test.ts` array-order and missing-product-drop assertions.
- [x] 5.2 Run `pnpm --filter backend test --coverage` — confirm ≥50%.
- [x] 5.3 Manually trace proposal's success criteria against the new tests: qty 99 persists+reads 200, qty 100 rejects 400 at both boundaries (validator middleware and `SyncCartUseCase`), duplicate merge yields one summed row, a previously-bricked cart (11-99 rows) now reads clean.

Checkbox task count: 12.

Dependency order: Phase 1 first (everything imports `MAX_CART_ITEM_QUANTITY`/`assertValidQuantity`); Phases 2-4 depend only on Phase 1 and may proceed in any order relative to each other; Phase 5 last.
