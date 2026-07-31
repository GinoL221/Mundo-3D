# Design: Cart Consistency

## Technical Approach

One invariant (`1 <= quantity <= 99`, integer) currently exists as three independent hard-coded copies: the express-validator range, the `ShoppingCart` constructor's `10`, and nothing at all on the write path. The fix collapses them to a single exported domain constant plus a single reusable domain assertion, then wires every layer to it. Duplicate-`productId` merging is application policy and lands in `SyncCartUseCase`.

Implements `cart-domain / Stock Limits Validation` (ceiling 10 → 99) and `cart-service / Duplicate Product ID Merge on Sync` + `Write-Path Domain Invariant Enforcement`.

## Architecture Decisions

### Decision: Entity validation lives in `SyncCartUseCase`, not the repository

**Choice**: `SyncCartUseCase.execute` calls `ShoppingCart.assertValidQuantity(quantity)` for every merged item **before** calling `ShoppingCartRepositoryPort.syncCart`. `SequelizeShoppingCartRepository.syncCart` receives only already-valid items and performs no business-rule validation — it stays a pure persistence adapter that maps domain data to Sequelize rows.
**Alternatives considered**: also guarding inside `SequelizeShoppingCartRepository.syncCart` ("defense in depth").
**Rationale**: this project's own architecture reference (Gentleman Book, "Arquitectura Hexagonal" chapter, `BankAccountService`/`BankAccountRepository` example) validates and constructs the entity in the service/use-case layer, before the repository is ever called — the repository only persists. Placing the guard in `SyncCartUseCase` matches that canonical pattern and matches how the rest of this codebase already centralizes business rules per entity use case, instead of scattering them across adapters. `toEntity()` reconstructing a `ShoppingCart` on read is a mapping concern, not precedent for enforcing a business rule from inside the adapter — the two are not symmetric.

**Rejected alternative — repository-level guard as defense-in-depth**: also calling `assertValidQuantity` inside `SequelizeShoppingCartRepository.syncCart` would guard against a hypothetical future caller of `ShoppingCartRepositoryPort` that bypasses `SyncCartUseCase`. No such caller exists today. If one is added later, validating is that future use case's own responsibility (and its code review's), consistent with how this codebase already scopes validation per use case rather than pushing it down into shared infrastructure "just in case."

### Decision: Expose a static assertion rather than fabricating an entity pre-insert

**Choice**: `ShoppingCart.assertValidQuantity(quantity: number): void`, called by the constructor and by `SyncCartUseCase` before persistence.
**Alternatives considered**: `new ShoppingCart(0, ...)` with a placeholder `idCart`; a `ShoppingCart.forNewItem()` factory.
**Rationale**: `idCart` does not exist before insert; passing `0` persists a lie into the domain layer. The static keeps one source of truth — the constructor delegates to it, so read-path and write-path rules cannot drift again. Maintenance constraint: every future `ShoppingCart` invariant MUST go into a static assert, never inline in the constructor.

### Decision: Merge duplicates before catalog lookup

**Choice**: group and sum by `productId` (insertion-ordered `Map`), assert the merged sum, then resolve products.
**Alternatives considered**: merge after the existing `findById` loop.
**Rationale**: fails fast with zero I/O on an invalid payload, and looks up a repeated `productId` once. Preserves the tested missing-product silent drop: a single unknown id still yields one group, one `findById`, one drop, `syncCart(userId, [])`. Insertion order preserves the existing array-order assertion. Accepted consequence: a payload whose duplicates overflow for a *nonexistent* product now 400s instead of silently dropping — payload validity is deliberately independent of catalog state. Because the validation guard now lives only in `SyncCartUseCase` (Decision 1 above, not duplicated in the repository), this assert-after-merge step is not merely a fail-fast optimization — it is the sole point where the 1–99 write-path invariant is enforced before `ShoppingCartRepositoryPort.syncCart` is ever called.

### Decision: Reuse `CartValidationException`; no new exception type

**Choice**: both new failures throw `CartValidationException`.
**Rationale**: `errorHandler.ts:25` already maps `name === 'CartValidationException'` to 400, and the class carries `status/statusCode = 400`. Response shape is unchanged: `{ error: "<message>" }` (plus `stack` outside production). No `/api` contract change beyond the corrected boundary.

### Decision: Wire the validator to the domain constant

**Choice**: `cartValidators.ts` uses `MAX_CART_ITEM_QUANTITY` instead of the literal `99`.
**Alternatives considered**: leave the file untouched per the proposal's "unchanged/verified".
**Rationale**: numerically a no-op today, but it removes the second hard-coded copy that made this split-brain possible. Infrastructure → domain import is already established in this file.

## Data Flow

    PUT /api/cart
      │
      ├─ cartSyncValidation ──── per-item 1..MAX ─────► 400 CartValidationException
      │
      ├─ SyncCartUseCase.execute
      │     1. merge by productId (sum, insertion order)
      │     2. assertValidQuantity per merged sum <= MAX ─► 400 CartValidationException, repository never called
      │     3. findById per distinct product → drop misses (unchanged)
      │     4. call SequelizeShoppingCartRepository.syncCart with already-valid items
      │
      ├─ SequelizeShoppingCartRepository.syncCart (pure persistence, no validation)
      │     5. tx: destroy ACTIVE → create rows → commit
      │
      └─ GetCartByUserIdUseCase → toEntity → new ShoppingCart  ► 200 (same rule as step 2)

Step 2 is the single write-path guard: a rejection never reaches the repository, so there is no partial or committed bad row to worry about. The defect being fixed was that raw writes could bypass entity validation entirely; now no write happens until `SyncCartUseCase` has validated it.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/domain/entities/ShoppingCart.ts` | Modify | Export `MAX_CART_ITEM_QUANTITY = 99`; add `static assertValidQuantity`; constructor delegates to it; ceiling 10 → 99 |
| `backend/src/application/use-cases/SyncCartUseCase.ts` | Modify | Merge duplicate `productId` (sum) before lookup; `assertValidQuantity` per merged sum (write-path guard, covers both merge-overflow and single-item overflow); throw before repository is called |
| `backend/src/infrastructure/repositories/SequelizeShoppingCartRepository.ts` | No change | Stays a pure persistence adapter; receives only already-validated items from `SyncCartUseCase` |
| `backend/src/infrastructure/middlewares/validators/cartValidators.ts` | Modify | Literal `99` → `MAX_CART_ITEM_QUANTITY` (behavior-preserving) |
| `.../__tests__/ShoppingCart.test.ts` | Modify | Boundary 10 → 99/100; cover `assertValidQuantity` directly |
| `.../__tests__/SyncCartUseCase.test.ts` | Modify | Merge case, merged-duplicate overflow case, single-item overflow case (retargeted write-path guard); existing two tests stay byte-identical |
| `.../__tests__/SequelizeShoppingCartRepository.test.ts` | Modify | Write-then-read round trip regression only (quantity 99); no validation-rejection test needed here since the repository performs no validation |
| `.../__tests__/validators/cartValidators.test.ts` | Modify | Confirm 99 passes / 100 rejects against the constant |

No port signature change: `syncCart(userId, items)` keeps its shape, so `ShoppingCartRepositoryPort` and every existing mock stay valid.

## Interfaces / Contracts

```ts
// backend/src/domain/entities/ShoppingCart.ts
export const MAX_CART_ITEM_QUANTITY = 99;

export class ShoppingCart {
  static assertValidQuantity(quantity: number): void; // throws CartValidationException
  constructor(/* unchanged signature */); // delegates to assertValidQuantity
}
```

Merge helper stays private to `SyncCartUseCase` (`private mergeItems(items): Map<number, number>`) — not part of any public contract.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — domain | 99 valid, 100 rejects, 0/negative/non-integer reject; `assertValidQuantity` and constructor agree | Jest, direct entity construction |
| Unit — use case | Duplicates sum to one entry; merged >99 (via duplicates, e.g. 120) throws `CartValidationException` and `cartRepo.syncCart` is never called; a single non-duplicate item at quantity 100 also throws and `cartRepo.syncCart` is never called (write-path guard); **both existing tests unmodified** | Jest with mocked ports |
| Integration — repository | **Split-brain regression (highest priority)**: capture the args `syncCart` passes to `db.ShoppingCart.create` at quantity 99, feed those exact values back through the `findAll` mock into `findByUserId`, assert `toEntity` does not throw and returns `quantity === 99`. Proves write output is readable by the read path. No validation-rejection test is needed here — the repository performs no validation. | Jest, mocked `db` |
| Integration — middleware | Validator boundary tracks the constant | Existing `cartValidators.test.ts` harness |

The round-trip test is the one that would have caught the original defect; it MUST fail RED before the domain ceiling is raised to 99 (Phase 1).

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. All changes are in-process TypeScript validation on an existing route.

## Migration / Rollout

No migration. No schema change, no UNIQUE constraint, no backfill. Existing 11–99 rows become valid the moment the ceiling lands; pre-existing duplicate rows self-clear on the user's next full-replace `PUT`.

Landing order within the single work unit: `ShoppingCart.ts` first (the use case imports `MAX_CART_ITEM_QUANTITY` / `assertValidQuantity`, and the repository's round-trip regression test depends on the raised ceiling), then the use case, the repository's round-trip regression test, and the validator in any order.

## Open Questions

None. All product decisions from the proposal are resolved.
