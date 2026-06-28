# Tasks: Standardize Naming Conventions — ShoppingCart (Slice 2C)

## Change Summary

Surgical completion of ShoppingCart naming standardization. The majority of camelCase work is already in place. Only 4 files require changes and 3 test files need verification/updates.

**Estimated scope:** ~60–80 lines changed across 4 production files + test updates.
**DB migration:** Not required (schema already correct; `field:` mappings confirmed in audit).

---

## Tasks

### TASK-01 — Add `@deprecated` JSDoc to PascalCase getterMethods in Sequelize Model

- **File:** `src/database/models/ShoppingCart.js`
- **Type:** Annotation (additive, no behavioral change)
- **Risk:** Low
- **Status:** [x] Completed

**What to do:**
Add a `/** @deprecated Use camelCase attribute `<name>` instead. */` JSDoc comment immediately before each of the 6 PascalCase getter methods in the `getterMethods` block:

| Getter | Replacement |
|--------|-------------|
| `IDCart()` | `idCart` |
| `IDUser()` | `idUser` |
| `IDProduct()` | `idProduct` |
| `Quantity()` | `quantity` |
| `UnitPrice()` | `unitPrice` |
| `CartStatus()` | `cartStatus` |

**Acceptance criteria:**
- Each getter method in `getterMethods` has a `@deprecated` JSDoc comment above it.
- No runtime behavior changed (no logic modifications).
- ESLint passes on the file.

---

### TASK-02 — Add `@deprecated` JSDoc to PascalCase Getters in Domain Entity

- **File:** `src/domain/entities/ShoppingCart.ts`
- **Type:** Annotation (additive, no behavioral change)
- **Risk:** Low
- **Status:** [x] Completed

**What to do:**
Add `/** @deprecated Use `<camelCase>` instead. */` immediately before each of the 6 PascalCase TypeScript getter definitions:

| Getter | Replacement |
|--------|-------------|
| `get IDCart()` | `idCart` |
| `get IDUser()` | `idUser` |
| `get IDProduct()` | `idProduct` |
| `get Quantity()` | `quantity` |
| `get UnitPrice()` | `unitPrice` |
| `get CartStatus()` | `status` |

**Acceptance criteria:**
- Each PascalCase getter in the domain entity has a `@deprecated` JSDoc comment.
- TypeScript compilation succeeds (`tsc --noEmit`).
- No runtime behavior changed.

---

### TASK-03 — Remove Legacy `idProduct` Fallback from CartApiController

- **File:** `src/infrastructure/controllers/CartApiController.ts`
- **Type:** Dead code removal + interface rename
- **Risk:** Low (fallback is unreachable; validator already enforces `productId` strictly)
- **Status:** [x] Completed

**What to do:**

1. Remove the `RawCartItem` interface:
   ```typescript
   // DELETE this:
   interface RawCartItem {
     idProduct?: number;
     productId?: number;
     quantity: number;
   }
   ```

2. Add the `CartSyncItem` interface in its place:
   ```typescript
   interface CartSyncItem {
     productId: number;
     quantity: number;
   }
   ```

3. In `syncCart`, replace the `rawItems` / ternary mapping block:
   ```typescript
   // DELETE:
   const rawItems = (req.body.items || []) as RawCartItem[];
   const items = rawItems.map((item: RawCartItem) => ({
     productId: typeof item.idProduct === 'number' ? item.idProduct : (item.productId ?? 0),
     quantity: item.quantity,
   }));

   // REPLACE WITH:
   const items = (req.body.items || []) as CartSyncItem[];
   ```

**Acceptance criteria:**
- `RawCartItem` no longer exists in the file.
- `CartSyncItem` is used as the type for sync request items.
- `syncCart` passes `items` directly to `syncCartUseCase.execute`.
- TypeScript compilation succeeds.
- No `any` types introduced.

---

### TASK-04 — Update Frontend Cart Store Sync Payload Key

- **File:** `frontend/src/store/cart.ts`
- **Type:** Single-line field rename
- **Risk:** Low (must deploy atomically with backend; no independent window)
- **Status:** [x] Completed

**What to do:**
On the line inside `syncToBackend` that constructs the payload (approximately line 53), rename `idProduct` to `productId`:

```typescript
// BEFORE:
const payload = items.map((i) => ({ idProduct: i.productId, quantity: i.quantity }));

// AFTER:
const payload = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
```

**Acceptance criteria:**
- `syncToBackend` sends `productId` (not `idProduct`) in the JSON body.
- No other lines in `cart.ts` changed.
- TypeScript compilation succeeds.

---

### TASK-05 — Update CartApiController Tests

- **File:** `src/infrastructure/controllers/__tests__/CartApiController.test.ts`
- **Type:** Test update (required)
- **Risk:** Low
- **Status:** [x] Completed

**What to do:**
Audit all tests in this file. Any test that constructs a mock request body with `idProduct` must be updated to use `productId`. The `RawCartItem` type reference (if imported or used in tests) must also be removed/replaced with `CartSyncItem` or an inline object.

**Acceptance criteria:**
- No test uses `idProduct` in the mock request body.
- All tests pass.
- No references to `RawCartItem` remain in the test file.

---

### TASK-06 — Verify cartValidators Tests Cover `idProduct` Rejection

- **File:** `src/infrastructure/middlewares/__tests__/validators/cartValidators.test.ts`
- **Type:** Test verification (may not need changes)
- **Risk:** Low
- **Status:** [x] Completed

**What to do:**
Review the test suite to confirm at least one test asserts that a payload containing only `idProduct` (without `productId`) results in an HTTP 400 response. If this test is missing, add it.

**Acceptance criteria:**
- A test exists asserting that `{ items: [{ idProduct: 12, quantity: 2 }] }` results in 400.
- A test exists asserting that `{ items: [{ productId: 12, quantity: 2 }] }` passes validation.
- All tests pass.

---

### TASK-07 — Verify apiSecurity Tests Have No `idProduct` References

- **File:** `src/__tests__/apiSecurity.test.js`
- **Type:** Test verification (may not need changes)
- **Risk:** Low
- **Status:** [x] Completed

**What to do:**
Search the file for any mock cart item construction that uses `idProduct`. If found, update to `productId`.

**Acceptance criteria:**
- No reference to `idProduct` in cart item mocks within this file.
- All security tests pass.

---

## Execution Order

```
TASK-01  ──┐
TASK-02  ──┤── Can run in parallel (annotations only)
TASK-03  ──┤
TASK-04  ──┘
              ↓
TASK-05  ──┐
TASK-06  ──┤── Run after production changes; can run in parallel
TASK-07  ──┘
              ↓
           Run full test suite to confirm all green
```

---

## Delivery Forecast

| Metric | Value |
|--------|-------|
| Files changed (production) | 4 |
| Files changed (tests) | 1–3 |
| Estimated lines changed | ~60–80 |
| DB migration script | Not required |
| Atomic deployment required | Yes (backend + frontend in same release) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
