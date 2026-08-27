# Tasks: Broader E2E Coverage

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | PR 1: ~260-340, PR 2: ~55-75, PR 3: ~90-130 |
| 400-line budget risk | Medium (PR 1 only; PR 2/PR 3 are Low) |
| Chained PRs recommended | No — three independent PRs, no shared helper module |
| Suggested split | PR 1 (admin-products) / PR 2 (auth rejections) / PR 3 (product-states) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — independent PRs, no chain needed |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

No threat matrix applies (design.md: N/A — no routing/shell/subprocess/VCS boundary changed). Test-only change; no production code diff, so no RED→GREEN production cycle — tasks author E2E specs against already-implemented behavior, per proposal scope.

**Spec-delta note**: PR 1 and PR 3 both edit `openspec/specs/e2e/spec.md` (different requirement blocks each). They are independent in code but not in that one file — apply/merge in either order, rebase PR 3's spec hunk if PR 1 lands first.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Admin product role gating, CRUD, destructive/non-idempotent guards | PR 1 | `pnpm --filter e2e test --project=chromium tests/admin-products.spec.ts` | Real backend+frontend via `playwright.config.ts` `webServer`, real MySQL test DB via `db:test:prepare` | Revert `admin-products.spec.ts` + STAFF fixture block in `test-prepare.js` + the ADDED requirement in `specs/e2e/spec.md`; zero runtime impact |
| 2 | Registration duplicate-email and missing-image rejections | PR 2 | `pnpm --filter e2e test --project=chromium tests/auth.spec.ts` | Same real backend+frontend harness, no interception | Revert the two appended `test()` blocks in `auth.spec.ts`; independent of PR 1/PR 3 |
| 3 | Listing/detail error and empty states | PR 3 | `pnpm --filter e2e test --project=chromium tests/product-states.spec.ts` | Same harness; `page.route()` fakes network edge only | Revert `product-states.spec.ts` + its requirement blocks in `specs/e2e/spec.md`; independent of PR 1/PR 2 |

## Phase 1: PR 1 — STAFF fixture and spec delta (foundation)

- [x] 1.1 Modify `backend/src/database/test-prepare.js`: require `bcryptjs` at top (as `seed.js` does); after `seedInitialData(db)`, insert `staff@email.com`/`staff123`, `idRole: 3`, `category: 'Staff'`, guarded by a `findOne` existence check (mirrors the existing Luigi product block); add a pointer comment naming `backend/src/domain/Role.ts` and `frontend/src/domains/auth/adapters/auth.adapter.ts` as drift-detection mirrors.
- [x] 1.2 Merge the ADDED "E2E Admin Product Management Verification" requirement (5 scenarios: Role-Based Visibility, Delete Restricted to Admin, Full Product CRUD Lifecycle, Stock Adjust Client-Side Double-Click Guard, 401 Mid-Session Redirects Silently) into `openspec/specs/e2e/spec.md`.

## Phase 2: PR 1 — `admin-products.spec.ts` scaffolding and fixture helpers

- [x] 2.1 Create `e2e/tests/admin-products.spec.ts` with `API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3032'` and a file-scope `test.beforeAll` that logs in via `playwright.request.newContext()` for ADMIN/STAFF/regular USER and writes `.auth/admin.json`, `.auth/staff.json`, `.auth/regular-user.json`.
- [x] 2.2 Implement `fixtureName(): string` — `"E2E-<seq>-<Date.now() % 1e8>"`, ≤ 20 chars, satisfies the 5-20 char `nameProduct` validator.
- [x] 2.3 Implement `createFixtureProduct(overrides?): Promise<{ idProduct, nameProduct }>` — multipart POST via a module-scoped ADMIN `adminApi` context, `X-CSRF-Token` set from the raw `m3d_csrf` cookie value read from `storageState()` (no decoding, mirrors `withCredentials()`), payload per design.md (`price: '1000'`, `descriptionProduct`, `idCategory: '1'`, `idFranchise: '1'`, `stock: '5'`, fake-buffer `image`).
- [x] 2.4 Implement `sweepFixtureProducts(): Promise<void>` — GET `/api/products`, DELETE every row whose `nameProduct` starts with `E2E-`, ignore 404; wire into `afterEach`.
- [x] 2.5 Implement `row(page, name)` locator helper — `page.locator('.users-list__card').filter({ hasText: name })`.

## Phase 3: PR 1 — Role visibility and delete-restriction scenarios (depends on Phase 2)

- [x] 3.1 Test "Role-Based Visibility": ADMIN and STAFF sessions see `#admin-products-content`; regular USER and guest sessions see `#admin-gate-denied`.
- [x] 3.2 Test "Delete Restricted to Admin": STAFF's product row has no `.admin-product-delete`; ADMIN's row does.

## Phase 4: PR 1 — CRUD lifecycle (depends on Phase 2)

- [x] 4.1 Test create: submit `#create-product-form` + `#create-btn`, assert redirect and the new row appearing via `.admin-product-name`.
- [x] 4.2 Test edit: submit `#edit-product-form` + `#edit-btn` on a fixture product, assert redirect and the updated field reflected in the row.
- [x] 4.3 Test delete: `page.once('dialog')` accept path removes the row; a separate dismiss path leaves the row intact and fires no DELETE request.

## Phase 5: PR 1 — Stock double-click guard (depends on Phase 2)

- [x] 5.1 Held-route setup: intercept `**/api/products/*/stock`, count matched requests, hold the first on a deferred promise before `route.continue()`.
- [x] 5.2 Trigger with `locator('.admin-product-stock-plus').dblclick()`; assert the control becomes disabled, `expect.poll(() => patchCount).toBe(1)` while held, then release and assert `.admin-product-stock` shows `initial + 1` and `patchCount === 1`.

## Phase 6: PR 1 — 401 mid-session redirect (depends on Phase 2)

- [x] 6.1 `route.fulfill({ status: 401 })` on a mutating admin action; assert silent redirect to `/login` with no message shown and no form state persisted (`handleUnauthorized()` → `clearSession()` → `window.location.href`).

## Phase 7: PR 2 — `auth.spec.ts` registration rejections (independent of Phases 1-6)

- [x] 7.1 Test "Duplicate Email Registration Rejected": submit registration reusing the seeded `gino@email.com`; assert `#register-error` visible with the exact string `Este email ya está registrado`, URL stays `/register`, no new user created.
- [x] 7.2 Test "Missing Image Registration Rejected": submit the form with `#image` left empty; assert `#register-error` shows exactly `Tienes que subir una imagen`, URL stays `/register`, no new user created.

## Phase 8: PR 3 — `product-states.spec.ts` listing states (independent of Phases 1-7)

- [ ] 8.1 Create `e2e/tests/product-states.spec.ts`.
- [ ] 8.2 Test listing error state: `page.route()` the listing API to `fulfill({ status: 500 })`; assert the listing page renders its error-state template.
- [ ] 8.3 Test listing empty state: `page.route()` the listing API to `fulfill({ status: 200, body: JSON.stringify({ products: [] }) })`; assert `#product-grid-container .empty-state h2` renders the empty-state copy.

## Phase 9: PR 3 — `product-states.spec.ts` detail states (depends on Phase 8's file)

- [ ] 9.1 Test detail error for a real nonexistent id (`/product?id=999999`, never allocated since `sync({force:true})` resets auto-increment each run); assert `#product-error` renders and `#product-title` does not.
- [ ] 9.2 Test detail error via an intercepted 500 on the detail API (network-failure branch); assert `#product-error` renders.

## Phase 10: PR 3 — remaining spec delta

- [ ] 10.1 Merge the MODIFIED "E2E Authentication Verification" requirement's two added scenarios (Duplicate Email Registration Rejected, Missing Image Registration Rejected) into `openspec/specs/e2e/spec.md`.
- [ ] 10.2 Merge the ADDED "E2E Product Listing/Detail Error & Empty State Verification" requirement (3 scenarios) into `openspec/specs/e2e/spec.md`.

## Phase 11: Verification (run per PR independently)

- [x] 11.1 Run `pnpm --filter e2e test --project=chromium tests/admin-products.spec.ts` 3 consecutive times — green, no flakes; confirm no seeded row is touched.
- [x] 11.2 Run `pnpm --filter e2e test --project=chromium tests/auth.spec.ts` — green, including pre-existing cases.
- [ ] 11.3 Run `pnpm --filter e2e test --project=chromium tests/product-states.spec.ts` — green.
- [ ] 11.4 Confirm each PR's spec-delta hunk validates independently (`openspec validate e2e-coverage --strict` or equivalent) and merges without conflict against the other.

Checkbox task count: 22.

Dependency order: Phase 1 (STAFF fixture + spec delta) precedes Phases 2-6, all PR 1. Phase 2 (scaffolding/helpers) precedes Phases 3-6, which may proceed in any order relative to each other. Phase 7 (PR 2) and Phase 8-10 (PR 3) are fully independent of Phase 1-6 and of each other. Phase 11 runs last, per PR, after its respective phases complete.
