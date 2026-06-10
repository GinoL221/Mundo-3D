# Design: Backend Layering

## Technical Approach

Pure refactoring across 8 items that move business logic from routes/controllers into services, extract shared middleware, and enforce a consistent one-file-per-action controller pattern. No behavior changes. TDD-first for new service methods; structural changes validated via file-content assertions and existing test suite.

**Critical prerequisite**: `app.js` lacks `server.set('views', ...)`. EJS defaults to `./views` relative to CWD. All current controllers use `path.join(__dirname, '../../views/...')` (absolute paths) which bypasses this. Switching to view names like `'users/login'` will fail unless we configure the views directory. **Fix**: add `server.set('views', path.join(__dirname, 'views'))` in `app.js` before any route mounts.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|----------|-------------|-----------|
| Add `server.set('views', path.join(__dirname, 'views'))` in `app.js` | Keep `path.join` in every controller; set views per-controller | Single source of truth; enables clean `res.render('viewName')` everywhere |
| `CartService.computeTotal` as sync pure function | Async DB query; standalone util module | Input is already-fetched array; no I/O needed; testable without mocks |
| Upload factory returns configured multer per call | Singleton with pre-configured instances | Each route needs different `dest`; factory pattern avoids shared mutable state |
| Validators in `src/middlewares/validators/` | Keep in routes; separate `src/validators/` dir | `middlewares/` is the existing convention for request-processing middleware |
| Barrel `src/controllers/main/index.js` re-exports named | Single file with all exports; dynamic require | Named exports enable tree-shape clarity; matches existing `controllers/products/` pattern |
| `userLogged` uses `UserService.findByEmail` | Pass models as dependency; separate auth service | `UserService` already owns user lookups; no new module needed |

## Data Flow

### Auth Flow (Items 1, 3)

```
  Route (loginValidation)
    → Controller (processLogin)
      → UserService.verifyPassword(plain, hash)     [NEW]
      → UserService.findByEmail(email, {includePassword})
        → db.User.findOne()
    → res.render('users/login', ...)                [view name, not path]

  Middleware (userLogged)
    → UserService.findByEmail(cookieEmail)          [NEW — was User.findOne]
      → db.User.findOne()
    → res.locals.userLogged
```

### Cart Flow (Item 2)

```
  Route (/productCart)
    → Controller (viewShoppingCart)
      → CartService.findByUserId(userId)
      → CartService.computeTotal(cartItems)         [NEW pure function]
    → res.render('products/productCart', { userShoppingCart, calcularTotal: CartService.computeTotal })
```

### API Products Flow (Item 6)

```
  Route (/api/products)
    → Controller (productApiController.index)
      → ProductService.findAll()
      → ProductService.transformWithCategoryCount(products)  [NEW]
    → res.json({ count, countByCategory, products })
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app.js` | Modify | Add `server.set('views', path.join(__dirname, 'views'))`; remove `path.join` from 404 handler |
| `src/services/userService.js` | Modify | Add `verifyPassword(plainPassword, hashedPassword)` sync method |
| `src/services/cartService.js` | Modify | Add `computeTotal(cartItems)` sync method |
| `src/services/productService.js` | Modify | Add `transformWithCategoryCount(products)` sync method |
| `src/services/index.js` | Modify | No change needed (services already exported) |
| `src/controllers/users/processLogin.js` | Modify | Replace `bcrypt.compareSync` with `UserService.verifyPassword`; replace `path.join` renders with view names; remove `bcrypt` import |
| `src/controllers/products/viewShoppingCart.js` | Modify | Remove inline `calcularTotal`; use `CartService.computeTotal`; replace `path.join` with view name |
| `src/controllers/products/postNewProduct.js` | Modify | Remove `if (!req.file)` duplicate check; replace `path.join` with view name |
| `src/middlewares/userLogged.js` | Modify | Replace `initializeModels`/`User.findOne` with `UserService.findByEmail` |
| `src/middlewares/upload.js` | Create | Factory: `createUpload({ dest })` returns configured multer with uuid filenames |
| `src/middlewares/validators/productValidators.js` | Create | Export `validationsForm` array (extracted from productsRoutes) |
| `src/middlewares/validators/userValidators.js` | Create | Export `validationsUsers` and `loginValidation` arrays |
| `src/routes/productsRoutes.js` | Modify | Import upload factory + validators; remove inline multer/validator definitions |
| `src/routes/userRoutes.js` | Modify | Import upload factory + validators; remove inline multer/validator definitions |
| `src/routes/api/products.js` | Modify | Thin routes delegating to controller; remove inline transformation logic |
| `src/controllers/api/productApiController.js` | Create | `index`, `show`, `latest` handlers calling ProductService |
| `src/controllers/main/index.js` | Create | Homepage controller (moved from mainController.js) |
| `src/controllers/main/aboutUs.js` | Create | About page controller (moved from inline route handler) |
| `src/controllers/main/index.js` barrel | Create | Re-exports `{ index, aboutUs }` — **NOTE**: barrel filename conflicts with action filename. Use `src/controllers/main/index.js` as barrel, `src/controllers/main/home.js` for index action |
| `src/controllers/mainController.js` | Delete | Replaced by `main/` directory |
| `src/routes/mainRoutes.js` | Modify | Import barrel; replace inline `/aboutUs` handler with controller delegation |

### Barrel Naming Resolution

`src/controllers/main/index.js` cannot be both the barrel and the home action. Convention: barrel = `index.js`, home action = `home.js`.

```
src/controllers/main/
├── index.js      ← barrel: module.exports = { home, aboutUs }
├── home.js       ← home page action
└── aboutUs.js    ← about page action
```

## Interfaces / Contracts

### UserService.verifyPassword

```js
// sync, pure delegation to bcryptjs
verifyPassword(plainPassword, hashedPassword) // → boolean
```

### CartService.computeTotal

```js
// sync, pure function
// Input: Array<{ product: { Price: number }, Quantity: number }>
// Output: number
computeTotal(cartItems) // → number
```

### ProductService.transformWithCategoryCount

```js
// sync, pure transformation
// Input: Array<Product with Category association>
// Output: { count: number, countByCategory: { [name]: { count, category } }, products: Array<mapped> }
transformWithCategoryCount(products)
```

### Upload Factory

```js
// src/middlewares/upload.js
const createUpload = ({ dest }) => {
  // returns multer instance with:
  //   diskStorage → dest: path.join(process.cwd(), dest)
  //   filename: uuidv4() + extname
  //   limits: { fileSize: 5MB }
};
module.exports = createUpload;
```

### Validator Modules

```js
// src/middlewares/validators/productValidators.js
module.exports = { validationsForm: [body(...), body(...), ...] };

// src/middlewares/validators/userValidators.js
module.exports = { validationsUsers: [body(...), ...], loginValidation: [body(...), ...] };
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `UserService.verifyPassword` correct/incorrect | Jest with real bcryptjs; no DB mock needed |
| Unit | `CartService.computeTotal` empty/multiple items | Pure function test; no mocks |
| Unit | `ProductService.transformWithCategoryCount` with/without category | Pure function test with mock product objects |
| Unit | Upload factory returns configured multer | Mock multer; verify dest and filename config |
| Integration | `processLogin` uses UserService, no bcrypt import | Jest mock UserService; assert no bcrypt import via file read |
| Integration | `userLogged` uses UserService, no User.findOne | Jest mock UserService.findByEmail; verify no db import |
| File assertion | No `path.join` in controllers; no `bcrypt` import in processLogin | `fs.readFileSync` + regex assertions |
| File assertion | Validators extracted, routes import them | `fs.readFileSync` + regex for import statements |
| Regression | Full `npm test` suite green | Existing tests unchanged; coverage ≥ 50% |

## Execution Order

Items are ordered by dependency and risk. Each item is independently commitable.

| Phase | Items | Rationale |
|-------|-------|-----------|
| **1. Foundation** | Views config in `app.js` | Unblocks all `path.join` → view name changes. Must be first. |
| **2. Service Methods** | 1 (verifyPassword), 2 (computeTotal), 6 (transformWithCategoryCount) | Pure functions, no dependencies on other items. TDD-first. |
| **3. Controller Updates** | 1 (processLogin bcrypt), 2 (viewShoppingCart), 8 (postNewProduct dedup) | Depend on Phase 2 service methods + Phase 1 views config. |
| **4. Middleware** | 3 (userLogged via service) | Independent of Phase 3; can run in parallel. |
| **5. Extraction** | 4 (upload factory), 5 (validators) | Independent of each other and Phase 3-4. Both touch route files. |
| **6. API Layer** | 6 (API controller) | Depends on Phase 2 service method. Route file change is independent. |
| **7. Consistency** | 7 (mainController split) | Independent; barrel pattern. Can run in parallel with Phase 5-6. |

## Migration / Rollout

No migration required. Pure refactoring — existing behavior preserved. Each item independently revertable via git. If `UserService.verifyPassword` breaks login, revert `processLogin.js` to `bcrypt.compareSync`. If `CartService.computeTotal` misbehaves, restore inline `calcularTotal`.

## Open Questions

- [ ] Confirm EJS view directory: `src/views/` — does `server.set('views', path.join(__dirname, 'views'))` resolve correctly when CWD is project root? (Answer: `__dirname` in `app.js` is `src/`, so `path.join(__dirname, 'views')` = `src/views/` — correct.)
- [ ] Should the upload factory also accept `limits` and `fileFilter` as optional params, or hardcode them? (Decision: hardcode for now — both routes use identical config. Factory can be extended later.)
- [ ] `middleware-pipeline` spec is a delta modifying a previous change's spec. Archive step must merge deltas correctly — no action needed in design, but orchestrator should verify spec merge during archive.
