# Design: Broader E2E Coverage

## Technical Approach

Three Playwright spec files, each self-contained (no shared helper module), so the three PRs stay independent. All state the specs need is either (a) created and destroyed by the spec itself through the real API, or (b) faked at the network edge with `page.route()`. Seeded rows are read, never mutated. No production code changes.

Verified constraints driving the design:

- `registerLimiter` short-circuits when `NODE_ENV === 'test'` (`backend/src/infrastructure/middlewares/registerLimiter.ts:24`), and `playwright.config.ts` starts the backend with `NODE_ENV: 'test'`. The proposal's rate-limiter risk does **not** apply to this harness; unique emails remain required only for DB uniqueness.
- Registration rejections both surface as `#register-error` text: duplicate email → `Este email ya está registrado` (`UserApiController.register` catch, 400); missing image → `Tienes que subir una imagen` (`userValidators.ts:57` → `handleValidationErrors` → `AuthService.register` reads `data.errors[0].msg`).
- Mutating product endpoints require `apiAuthMiddleware` + `csrfGuard`; DELETE additionally requires `adminGuard` (ADMIN only).

## Architecture Decisions

### Decision: Role sessions via per-file `storageState`, generated in `beforeAll`

**Choice**: A file-scope `test.beforeAll` logs in through `request.newContext()` against the API for ADMIN / STAFF / regular USER and writes `.auth/admin.json`, `.auth/staff.json`, `.auth/regular-user.json`; each `test.describe` declares `test.use({ storageState: ... })`. Guest uses the default context. `.auth/` is already gitignored.

| Option | Tradeoff | Decision |
|---|---|---|
| Reuse `.auth/user.json` | Written as a side effect of `auth.spec.ts`'s login test — cross-file order dependency | Rejected |
| UI login in `beforeEach` (as `cross-tab-session.spec.ts` does) | Deterministic but adds 4 role logins per test | Rejected for cost |
| API login once → `storageState` per role | Same `storageState` pattern as `cart.spec.ts`, no cross-file coupling | **Chosen** |

**Rationale**: keeps the established `storageState` convention while removing the ordering coupling that makes `.auth/user.json` fragile.

### Decision: Fixture products are created and swept by an ADMIN `APIRequestContext`

**Choice**: One module-scoped `adminApi = await playwright.request.newContext({ baseURL: API_URL })`, logged in as `admin@email.com`. Its `m3d_csrf` cookie value is read verbatim from `storageState()` (no decoding — this mirrors `withCredentials()`, which forwards the raw `document.cookie` value) and sent as `X-CSRF-Token`. Every fixture product is named `E2E-<seq>-<Date.now() % 1e8>` (≤ 20 chars, satisfies the 5–20 `nameProduct` validator). `afterEach` lists `/api/products` and DELETEs every row whose `nameProduct` starts with `E2E-`, ignoring 404.

**Alternatives considered**: creating fixtures through the browser page (needs per-role CSRF plumbing and fails for STAFF on DELETE); truncating tables between tests (would destroy seeded rows other specs depend on).

**Rationale**: the sweep is idempotent and role-independent, so a test that fails mid-flow still cannot leak a row into the next test under `workers: 1`. Seeded rows are never matched by the `E2E-` prefix.

### Decision: In-flight double-click guard asserted with a held route + `dblclick()`

**Choice**: intercept `**/api/products/*/stock`, count the requests, and hold the first one on a deferred promise before `route.continue()`. Trigger with `locator.dblclick()`.

**Alternatives considered**: `dispatchEvent('click')` — rejected, it bypasses the browser's own suppression of events on disabled controls and would therefore test something no real user can do; two sequential `click()` calls — rejected, the second waits for actionability and would block until the first request settles; `waitForTimeout` — rejected as inherently flaky.

**Rationale**: `applyDelta` sets `disabled = true` synchronously inside the click listener, so the second click of a real double-click lands on a disabled button and the browser drops it. `dblclick()` reproduces exactly that input sequence. Scope is the client guard only — backend atomicity is documented tech debt (`AdjustProductStockUseCase.ts`).

```
test          browser (admin list)        route handler        backend
 |  dblclick() ------->|
 |                     | click#1 → disabled=true, PATCH ---->|
 |                     | click#2 → suppressed (disabled)     | (held)
 |  expect(+).toBeDisabled()                                 |
 |  expect.poll(patchCount).toBe(1)                          |
 |  release() ----------------------------------------------->| PATCH
 |                     |<-- stock = initial + 1 -------------|
 |  expect(.admin-product-stock).toHaveText(initial+1)
 |  expect(patchCount).toBe(1)
```

### Decision: Error/empty states faked at the network edge, detail 404 driven by a real id

**Choice**: `page.route(...).fulfill()` for listing error (500) and listing empty (`200 {"products":[]}`); a real nonexistent id (`/product?id=999999`) for the detail error, plus one intercepted 500 for the network-failure branch.

**Rationale**: interception keeps the backend untouched so the suite stays deterministic under `fullyParallel: false`. The detail 404 needs no interception because the id can never exist (`sync({force:true})` per run, auto-increment). Note `APIRequestContext` requests bypass `page.route`, so fixture setup is never affected by an active interception.

### Decision: STAFF fixture hardcodes `idRole: 3` in `test-prepare.js`

**Choice**: after `seedInitialData(db)`, insert `staff@email.com` / `staff123` with `idRole: 3`, `category: 'Staff'`, guarded by a `findOne` existence check — same shape as the existing Luigi product block. `bcryptjs` is required at the top of the file, as `seed.js` does.

**Alternatives considered**: importing `Role.STAFF` from `backend/src/domain/Role.ts` — rejected, `db:test:prepare` runs `node src/database/test-prepare.js` with no TS loader; adding STAFF to `data/users.json` — rejected, that file is production seed data.

**Rationale**: matches how `users.json` already hardcodes roles 1 and 2. Drift is contained by a pointer comment naming both mirrors (`backend/src/domain/Role.ts`, `frontend/src/domains/auth/adapters/auth.adapter.ts`) and by the STAFF visibility tests themselves, which fail loudly if 3 stops meaning STAFF.

## Data Flow

```
beforeAll ── API login ──> .auth/{admin,staff,regular-user}.json
   │
   ├─ test ── adminApi POST /api/products (E2E-… fixture) ──> MySQL test DB
   │            │
   │            └─ page (storageState) ── UI action ──> backend ── assert DOM
   │
   └─ afterEach ── adminApi GET /products → DELETE where name ^= "E2E-"
```

## File Changes

| File | Action | Description |
|---|---|---|
| `e2e/tests/admin-products.spec.ts` | Create | Role visibility, CRUD, confirm dialog, stock guard, 401 redirect |
| `e2e/tests/product-states.spec.ts` | Create | Listing error/empty, detail error |
| `e2e/tests/auth.spec.ts` | Modify | Append duplicate-email and missing-image rejections |
| `backend/src/database/test-prepare.js` | Modify | Seed STAFF (role 3) fixture user |
| `openspec/specs/e2e/spec.md` | Modify | Delta spec |

## Interfaces / Contracts

Helpers local to `admin-products.spec.ts`:

```ts
const API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3032';

function fixtureName(): string;                    // "E2E-<seq>-<ts>", <= 20 chars
async function createFixtureProduct(              // multipart POST via adminApi
  overrides?: { stock?: number; price?: number }
): Promise<{ idProduct: number; nameProduct: string }>;
async function sweepFixtureProducts(): Promise<void>;   // afterEach
const row = (page: Page, name: string) =>
  page.locator('.users-list__card').filter({ hasText: name });
```

Fixture product payload: `nameProduct`, `price: '1000'`, `descriptionProduct: 'E2E fixture'`, `idCategory: '1'`, `idFranchise: '1'`, `stock: '5'`, `image: { name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('fake image content') }` — the same fake-buffer trick `auth.spec.ts` already uses; `upload.ts`'s `fileFilter` accepts it on extension + mimetype.

Selectors (all already present in production markup — no test hooks needed):

| Surface | Selector |
|---|---|
| Admin gate | `#admin-products-content`, `#admin-gate-denied` |
| Row fields | `.admin-product-name`, `.admin-product-stock`, `.admin-product-delta` |
| Row actions | `.admin-product-stock-plus`, `.admin-product-edit`, `.admin-product-delete` |
| Create / edit forms | `#create-product-form` + `#create-btn` / `#edit-product-form` + `#edit-btn`, `#admin-edit-load-error` |
| Registration error | `#register-error` |
| Listing states | `#product-grid-container .empty-state h2` |
| Detail error | `#product-error`, `#product-title` |

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit / Integration | Unchanged | No production code changes |
| E2E — admin | ADMIN sees content; STAFF sees content but no `.admin-product-delete`; regular USER and guest see `#admin-gate-denied`; create via form → redirect + row appears; edit via form → redirect + updated field; delete → `page.once('dialog')` accept (row removed) and a dismiss case (row stays, no DELETE fired); stock `dblclick()` guard; `route.fulfill(401)` on PATCH → `/login` with no message | Real UI against real backend, fixtures via `adminApi` |
| E2E — auth | Duplicate email uses the seeded `gino@email.com` (no intra-file ordering dependency); missing image submits the form with `#image` left empty. Both assert `#register-error` is visible with the exact contract string and that the URL stays `/register` | Real backend, no interception |
| E2E — states | 500, `{"products":[]}`, and detail 404/500 | `page.route()` + real nonexistent id |

The two listing templates share `.empty-state`; their only differentiator is the `h2` copy (`Próximamente` vs `No se pudo cargar`). Asserting that copy is accepted here under the proposal's rule that copy may be asserted where it is the contract.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is changed. `test-prepare.js` keeps its existing invocation shape (`node src/database/test-prepare.js` from `global-setup.ts`); only a seed row is added.

## Migration / Rollout

No migration required. `test-prepare.js` recreates the schema with `sync({ force: true })` on every run, so the STAFF fixture appears automatically in local and CI test databases; production seed data is untouched.

**PR split — confirms the proposal's forecast**, refined now that scope is concrete:

1. `admin-products.spec.ts` (~230–300) + `test-prepare.js` (~20) + spec delta → **~260–340 lines**
2. `auth.spec.ts` additions → **~55–75 lines**
3. `product-states.spec.ts` → **~90–130 lines**

Independent PRs, no stacking (no shared files or helper module). Decision needed before apply: Yes. Chained PRs recommended: No. 400-line budget risk: Medium (PR 1 only).

## Open Questions

- [ ] None blocking. One accepted residue: fixture image uploads land in `backend/public/img/products/` (gitignored) and are not removed when the product row is deleted — pre-existing behavior, not introduced here.
