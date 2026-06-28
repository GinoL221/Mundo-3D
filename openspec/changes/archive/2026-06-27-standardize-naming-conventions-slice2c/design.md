# Technical Design: Standardize Naming Conventions — ShoppingCart (Slice 2C)

## Summary

After auditing the full ShoppingCart stack — Sequelize model, DB type definitions, domain entity, repository, DTOs, use cases, controller, validators, and the Astro frontend store — the delta between the current state and the target spec is **minimal and surgical**. The majority of the camelCase standardization is already in place. This design focuses exclusively on the four genuine gaps that remain.

---

## Current State vs. Target: Gap Analysis

| Layer | File | Current State | Target State | Action Required |
|---|---|---|---|---|
| Sequelize Model | `ShoppingCart.js` | `getterMethods` PascalCase block present, no `@deprecated` annotations | Same, with `@deprecated` JSDoc comments | Add JSDoc `@deprecated` to each getter |
| Domain Entity | `ShoppingCart.ts` | PascalCase getters (`IDCart`, etc.) present, no `@deprecated` annotations | Same, with `@deprecated` JSDoc comments | Add JSDoc `@deprecated` to each getter |
| Controller | `CartApiController.ts` | `RawCartItem.idProduct?` field + ternary fallback logic in `syncCart` | Strict `productId` only; no `idProduct` fallback | Remove `idProduct` from `RawCartItem`, simplify mapping |
| Frontend Store | `frontend/src/store/cart.ts` | `syncToBackend` sends `{ idProduct: i.productId, quantity: i.quantity }` | Must send `{ productId: i.productId, quantity: i.quantity }` | Replace `idProduct` with `productId` on line 53 |
| DB Types | `db.d.ts` | `ShoppingCartAttributes` has both camelCase and PascalCase optional fields | No change needed | ✅ No change |
| DB Model Field Mapping | `ShoppingCart.js` | All `field:` properties correctly map to snake_case columns | No change needed | ✅ No change |
| Repository | `SequelizeShoppingCartRepository.ts` | All queries and entity mapping use camelCase | No change needed | ✅ No change |
| DTOs | `ShoppingCartDTO.ts` | All fields are camelCase | No change needed | ✅ No change |
| Use Cases | `SyncCartUseCase.ts`, `GetCartByUserIdUseCase.ts` | Already use `productId`, camelCase throughout | No change needed | ✅ No change |
| Port | `IShoppingCartRepository.ts` | `syncCart` signature already uses `{ productId, quantity, unitPrice }` | No change needed | ✅ No change |
| Validators | `cartValidators.ts` | Already validates `items.*.productId` strictly; no `idProduct` accepted | No change needed | ✅ No change |
| Associations | `index.js` | `foreignKey: 'idUser'` / `'idProduct'` — Sequelize resolves via `field:` mapping | No change needed | ✅ No change |

---

## Detailed File Modifications

### 1. `src/database/models/ShoppingCart.js` — Add `@deprecated` to PascalCase Getters

**Rationale:** The `getterMethods` block provides backward-compatible PascalCase accessors. Per the spec, these must be annotated as `@deprecated` so consumers know not to rely on them. No behavioral change; annotation only.

**Change:**

```diff
     getterMethods: {
+      /** @deprecated Use camelCase attribute `idCart` instead. */
       IDCart() {
         return this.getDataValue('idCart');
       },
+      /** @deprecated Use camelCase attribute `idUser` instead. */
       IDUser() {
         return this.getDataValue('idUser');
       },
+      /** @deprecated Use camelCase attribute `idProduct` instead. */
       IDProduct() {
         return this.getDataValue('idProduct');
       },
+      /** @deprecated Use camelCase attribute `quantity` instead. */
       Quantity() {
         return this.getDataValue('quantity');
       },
+      /** @deprecated Use camelCase attribute `unitPrice` instead. */
       UnitPrice() {
         return this.getDataValue('unitPrice');
       },
+      /** @deprecated Use camelCase attribute `cartStatus` instead. */
       CartStatus() {
         return this.getDataValue('cartStatus');
       },
     },
```

---

### 2. `src/domain/entities/ShoppingCart.ts` — Add `@deprecated` to PascalCase Getters

**Rationale:** The domain entity exposes PascalCase getters for legacy callers. These must be annotated with `@deprecated` JSDoc so TypeScript tooling warns consumers who access them.

**Change:**

```diff
+  /** @deprecated Use `idCart` instead. */
   get IDCart(): number {
     return this.idCart;
   }

+  /** @deprecated Use `idUser` instead. */
   get IDUser(): number {
     return this.idUser;
   }

+  /** @deprecated Use `idProduct` instead. */
   get IDProduct(): number {
     return this.idProduct;
   }

+  /** @deprecated Use `quantity` instead. */
   get Quantity(): number {
     return this.quantity;
   }

+  /** @deprecated Use `unitPrice` instead. */
   get UnitPrice(): number {
     return this.unitPrice;
   }

+  /** @deprecated Use `status` instead. */
   get CartStatus(): string {
     return this.status;
   }
```

---

### 3. `src/infrastructure/controllers/CartApiController.ts` — Remove Legacy `idProduct` Fallback

**Rationale:** The controller currently accepts both `idProduct` (legacy) and `productId` (standard) in request items via the `RawCartItem` interface and a ternary resolution. The spec requires strict `productId`-only parsing; the legacy fallback must be removed. The validator middleware (`cartValidators.ts`) already enforces `items.*.productId` strictly, so any request using `idProduct` is already rejected at the middleware layer before reaching the controller. The controller-level fallback is therefore unreachable dead code that should be eliminated.

**Change:**

```diff
-interface RawCartItem {
-  idProduct?: number;
-  productId?: number;
-  quantity: number;
-}
+interface CartSyncItem {
+  productId: number;
+  quantity: number;
+}

   syncCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
     try {
       const userId = req.user?.userId;
       if (!userId) {
         res.status(401).json({ error: 'Usuario no autenticado' });
         return;
       }

-      const rawItems = (req.body.items || []) as RawCartItem[];
-      const items = rawItems.map((item: RawCartItem) => ({
-        productId: typeof item.idProduct === 'number' ? item.idProduct : (item.productId ?? 0),
-        quantity: item.quantity,
-      }));
+      const items = (req.body.items || []) as CartSyncItem[];
       await this.syncCartUseCase.execute(userId, items);
```

---

### 4. `frontend/src/store/cart.ts` — Send `productId` Instead of `idProduct` in Sync Payload

**Rationale:** The `syncToBackend` function constructs the JSON payload with the legacy key `idProduct`. The backend validator now strictly requires `productId`. This single field name change aligns the frontend payload with the API contract.

**Change:**

```diff
-    const payload = items.map((i) => ({ idProduct: i.productId, quantity: i.quantity }));
+    const payload = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
```

---

## Architecture Decisions

### AD-1: No Database Migration Script Required

The Sequelize model already maps camelCase JS attributes to snake_case physical columns via the `field:` option (e.g., `idCart → id_cart`, `unitPrice → unit_price`). The database columns are therefore already in snake_case in the development environment. A migration DDL is only required if a legacy environment has columns in the old names. The spec's `cart-domain/spec.md` describes the physical column renaming as the **target state**, not a delta — and the `field:` mappings confirm the target state is already achieved at the ORM level. No migration script will be produced unless an environment audit reveals stale column names.

### AD-2: Validator Middleware is the Single Enforcement Point

`cartValidators.ts` already rejects any request missing `productId` or containing only `idProduct`. Since the validator runs before the controller, removing the controller-side fallback does not change observable behavior — it removes dead code and makes the enforcement model clearer.

### AD-3: `RawCartItem` Renamed to `CartSyncItem`

The interface rename is intentional: `Raw` implied partial/unvalidated input. After removing the `idProduct` fallback, the type no longer represents a raw union — it is a clean, validated contract type. The rename improves readability and removes the misleading "raw" connotation.

### AD-4: `@deprecated` Annotations Are Documentation-Only

No runtime behavior changes. TypeScript IDEs (VSCode, etc.) will surface deprecation strikethroughs when code accesses `IDCart`, `IDUser`, etc. This is the minimum-risk backward-compatibility strategy aligned with the proposal.

---

## Data Flow: Sync Cart (Before → After)

```
Frontend (cart.ts)
  BEFORE: { items: [{ idProduct: 42, quantity: 2 }] }
  AFTER:  { items: [{ productId: 42, quantity: 2 }] }
         ↓
cartSyncValidation middleware (cartValidators.ts)
  Validates items.*.productId >= 1, items.*.quantity 1-99
  Already correct, no change
         ↓
CartApiController.syncCart
  BEFORE: Resolves idProduct|productId via ternary
  AFTER:  Reads items as CartSyncItem[] directly
         ↓
SyncCartUseCase.execute(userId, items)
  No change
         ↓
SequelizeShoppingCartRepository.syncCart(userId, syncItems)
  No change
         ↓
ShoppingCart Sequelize model
  Writes: idUser -> id_user, idProduct -> id_product, unitPrice -> unit_price, cartStatus -> cart_status
  field: mappings already in place, no change
```

---

## Files Changed Summary

| File | Change Type | Risk |
|---|---|---|
| `src/database/models/ShoppingCart.js` | JSDoc annotation (additive) | Low — annotation only |
| `src/domain/entities/ShoppingCart.ts` | JSDoc annotation (additive) | Low — annotation only |
| `src/infrastructure/controllers/CartApiController.ts` | Remove dead code, rename interface | Low — validator already enforces; change is unreachable code |
| `frontend/src/store/cart.ts` | Change payload key `idProduct` → `productId` | Low — must deploy atomically with backend |

**Total files modified: 4**

---

## Test Impact

| Test File | Update Required | Reason |
|---|---|---|
| `src/infrastructure/controllers/__tests__/CartApiController.test.ts` | **Yes** | Any test that sends `idProduct` in mock request body must now send `productId` |
| `src/infrastructure/middlewares/__tests__/validators/cartValidators.test.ts` | Verify | Confirm existing tests already cover rejection of `idProduct`-only payloads |
| `src/__tests__/apiSecurity.test.js` | Verify | Review any mock that constructs cart items with `idProduct` |
| `src/application/__tests__/GetCartByUserIdUseCase.test.ts` | No | No interface changes in this use case |

---

## Deployment Sequence

Since the frontend change (`idProduct → productId`) and the controller change (removing the fallback) are being deployed together:

1. Deploy backend changes (controller cleanup, domain annotations) first.
2. Deploy frontend change immediately after, or in the same release.

> **Note:** The backend validator already rejects `idProduct`-only payloads. There is no window where the old frontend would work against the new backend — the validator makes this change already breaking from the middleware perspective. Atomic deployment of backend + frontend in the same release is required.
