# Proposal: Cart Consistency

## Intent

Two confirmed, reproducible defects corrupt cart state:

1. **Quantity split-brain (user-facing).** `cartValidators.ts` accepts quantity 1–99; `ShoppingCart.ts:20-28` caps at 10. The write path persists raw rows without constructing the entity, so 11–99 commits — then every later `GET`/`PUT` for that user returns 400 and the cart page is bricked until they resubmit with all quantities ≤10.
2. **Duplicate product IDs.** No dedup in validator, use case, or schema. A repeated `productId` in one `PUT /api/cart` creates duplicate ACTIVE rows, double-counting item count and total.

The intended ceiling was always 1–99; the entity's 10 is arbitrary and ties to no business rule.

## Scope

### In Scope
- Align `ShoppingCart` entity ceiling to 1–99; correct `ShoppingCart.test.ts` boundary assertions.
- Merge duplicate `productId` entries by summing quantities before persistence.
- Enforce the ceiling on merged sums (cap vs. reject — see Open Questions).
- Close the write-path validation bypass so persisted rows cannot violate invariants the read path enforces.
- Regression tests: write-then-read round trip, duplicate merge.
- Document last-write-wins `PUT` concurrency as an accepted tradeoff (no code change).

### Out of Scope
- Catalog scalability; authentication.
- `Order` entity, stock decrement, checkout semantics — `order-checkout-and-stock`. Handoff: `CartList.astro:130-142` → `CartService.checkout()`, untouched here.
- `GET /api/cart` reconciliation on load (`loadCartFromStorage()` never reads the server) — real gap, candidate follow-up.
- Optimistic concurrency (version/ETag).
- Missing-product silent drop in `SyncCartUseCase` — tested and intentional, unchanged.
- Stock-bounded ceilings (see Deferred Decisions).

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `cart-domain`: "Stock Limits Validation" ceiling 10 → 99.
- `cart-service`: sync MUST merge duplicate `productId` entries; persisted rows MUST satisfy domain invariants.

## Approach

Exploration approach 1 (minimal correctness). One cohesive work unit — both defects live on the same write path, so splitting would duplicate test scaffolding. No migration needed: after the ceiling fix, existing 11–99 rows become valid; duplicate rows clear on the next full-replace `PUT`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/domain/entities/ShoppingCart.ts` | Modified | Ceiling 10 → 99 |
| `backend/src/application/use-cases/SyncCartUseCase.ts` | Modified | Merge duplicate `productId` |
| `backend/src/infrastructure/repositories/SequelizeShoppingCartRepository.ts` | Modified | Close write-path validation bypass |
| `backend/src/infrastructure/middlewares/validators/cartValidators.ts` | Unchanged/verified | 1–99 already correct |
| `backend/src/**/__tests__/` (ShoppingCart, SyncCartUseCase, cartValidators, CartApiController) | Modified | Boundary + merge coverage |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Changing `SyncCartUseCase` regresses tested missing-product silent drop | Med | Keep existing assertions green, unmodified |
| File-collision with `order-checkout-and-stock` at the checkout boundary | Med | Record boundary; do not touch `checkout()` |
| 400-line review budget | Med | ~250–320 authored lines incl. spec deltas; slice if tasks forecast High |

## Rollback Plan

Single revert of the change branch. No migration, no schema change, no data backfill — reverting restores the prior 10-cap entity and re-exposes the original defects, nothing more.

## Deferred Decisions

For `order-checkout-and-stock`: the durable ceiling should be bounded by `Product.stock` (currently nullable, unused in cart logic) and revalidated **at checkout**, not only at add-to-cart, to cover stock changing between sync and checkout. Open: what a `null` stock means (unlimited vs. blocked).

## Dependencies

None. Independent of `order-checkout-and-stock`.

## Success Criteria

- [ ] A `PUT /api/cart` with quantity 99 persists and the following `GET` returns 200.
- [ ] Quantity 100 is rejected at both validator and entity with a 400.
- [ ] A payload with the same `productId` twice yields one row with the summed quantity and a correct total.
- [ ] A user whose cart previously 400'd on `GET` can load it again without resubmitting.
- [ ] `pnpm test` green; coverage ≥ 50%.

## Open Questions

1. Merged quantity above 99: cap at 99 or reject the request with 400?
2. Pre-existing duplicate rows double-count until the user's next sync. Acceptable, or is a read-side dedup needed?
