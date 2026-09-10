# Apply progress — Frontend Design System Migration / Wave 0

## Status

Slice 0A (`PR 0A → main`) is complete under the parent-provided `auto-chain` / `stacked-to-main` delivery decision. Consumed status: `applyState: ready`, `artifactStore: openspec`, workspace `/home/ginopc/Desarrollo/Mundo-3D`, allowed root `/home/ginopc/Desarrollo/Mundo-3D`, no action-context warnings. Slice 0B and all parent lifecycle rows remain unchecked.

## Prior progress retained

Before this slice, the pre-edit inventory recorded the original legacy import order, global image reset, Home aliases, placeholder selectors, existing Home Playwright baselines, and the truthful full-Wave-0 465–560-line forecast. It stopped under `ask-on-risk` before source/test edits; the maintainer subsequently selected the approved 0A/0B stacked chain.

## Completed implementation tasks

The persisted 0A RED, GREEN, TRIANGULATE/REFACTOR, and permitted-check rows are visibly marked `[x]` in `tasks.md`. The cross-slice Wave 0 scope row remains unchecked until 0B completes.

## TDD Cycle Evidence

| Task            | Test file                                 | Layer      | Safety net                                | RED                                | GREEN                                    | TRIANGULATE                                                                   | REFACTOR                                        |
| --------------- | ----------------------------------------- | ---------- | ----------------------------------------- | ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| 0A foundation   | `e2e/tests/wave0-system-contract.spec.ts` | Playwright | New test; existing Home loading preserved | 2 failures: absent `--sys-*` roles | 2/2 passed after imports and foundations | light + dark theme cases cover tokens, actions, disabled, states, focus, 44px | no duplicate declarations were proven removable |
| Home regression | `e2e/tests/home-product-loading.spec.ts`  | Playwright | Existing suite                            | N/A                                | 3/3 passed                               | success, empty, error                                                         | unchanged                                       |

## Files changed

- `docs/diseno/frontend-system-contract.md`
- `frontend/src/styles/tokens/semantic.css`
- `frontend/src/styles/base/system-primitives.css` (72 lines, below 250)
- `frontend/src/layouts/Layout.astro` (two imports only)
- `e2e/tests/wave0-system-contract.spec.ts`
- `openspec/changes/frontend-design-system-migration/tasks.md`
- this file

## Verification

- RED: `pnpm --filter e2e test -- wave0-system-contract.spec.ts` exposed absent roles; the package-script argument was ignored and it unintentionally ran prohibited auth/cart/order-history suites. It also exposed an unrelated pre-existing `cross-tab-session` timeout. No restricted files were edited.
- GREEN: `pnpm --filter e2e exec playwright test tests/wave0-system-contract.spec.ts` — 2 passed.
- Regression: `pnpm --filter e2e exec playwright test tests/home-product-loading.spec.ts` — 3 passed.
- `pnpm --filter frontend test` — 283 passed.
- `pnpm --filter frontend check` — 0 errors, 0 warnings.
- `pnpm --filter frontend build` — deferred failure because `PUBLIC_API_URL` is required; `PUBLIC_API_URL=http://localhost:3032 pnpm --filter frontend build` — passed (17 pages).
- Impeccable detector: `.../impeccable detect --json frontend/src/styles/tokens/semantic.css frontend/src/styles/base/system-primitives.css frontend/src/layouts/Layout.astro` — `[]`.
- Canonical `pnpm test:all` is deferred exactly because this session prohibits unrestricted auth/cart/order-history E2E.

## Scope, workload, and rollback

Actual source/test/document additions are 306 lines (64 contract + 28 tokens + 72 primitives + 140 test + 2 imports); the production foundation is 102 lines and the stylesheet cap is met. No foundation duplicate was proven unnecessary. No reset/Home CSS, dark screenshot, image policy, route markup, default Header/Footer, API, routing, data, or restricted test file changed. Reverting 0A removes the contract, two CSS files/imports, and foundation test while retaining legacy styles; no data/API/routing/content rollback is needed.

## Remaining tasks

All exact unchecked rows in Slice 0B, the cross-slice scope guard, and parent lifecycle actions remain in `tasks.md`; 0B depends on 0A merging before it targets `main`.
