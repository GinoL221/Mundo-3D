# Apply progress — Frontend Design System Migration / Wave 0

## Status

Slice 0A (`PR 0A → main`) and Slice 0B (`PR 0B → main`) are complete under the parent-provided `auto-chain` / `stacked-to-main` delivery decision. Consumed status: `applyState: ready`, `artifactStore: openspec`, workspace `/home/ginopc/Desarrollo/Mundo-3D`, allowed root `/home/ginopc/Desarrollo/Mundo-3D`, no action-context warnings. Only the two parent lifecycle rows remain unchecked.

## Prior progress retained

Before this slice, the pre-edit inventory recorded the original legacy import order, global image reset, Home aliases, placeholder selectors, existing Home Playwright baselines, and the truthful full-Wave-0 465–560-line forecast. It stopped under `ask-on-risk` before source/test edits; the maintainer subsequently selected the approved 0A/0B stacked chain.

## Completed implementation tasks

The persisted 0A and 0B RED, GREEN, TRIANGULATE/REFACTOR, and permitted-check rows are visibly marked `[x]` in `tasks.md`. The cross-slice Wave 0 scope row is also complete; only parent-owned review lifecycle rows remain unchecked.

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

The earlier apply checkpoint left Slice 0B and parent lifecycle rows pending. Slice 0B is now complete on top of committed 0A `0c384e3`; only the two parent-owned review lifecycle rows remain in `tasks.md`.

## Slice 0B completion

Slice 0B is complete against committed 0A `0c384e3` under the provided `auto-chain` / `stacked-to-main` delivery path. Consumed status: `applyState: ready`, `artifactStore: openspec`, workspace and allowed root `/home/ginopc/Desarrollo/Mundo-3D`, assigned slice `0B`, no action-context warnings. All nine implementation-owned 0B and cross-slice scope rows are visibly marked `[x]` in `tasks.md`; the two parent lifecycle rows remain unchecked and are not apply-owned.

### Completed work and boundary

- The reset now leaves ordinary images at `auto` while excluding the canonical `[data-image-rendering='pixel-art']` marker from that default. The two existing Home placeholder selectors remain explicit legacy compatibility aliases; no route markup, assets, card/grid layout, or other placeholder owner changed.
- `home-shell.css` aliases only admitted frame, gutter, prose, color, surface, border, and action values using literal `var(--sys-*, fallback)` forms. Home-specific sizing, commission values, selectors, responsive modes, behavior, and content remain intact.
- The contract suite proves generic real product and approved-brand images render normally, while canonical and both Home compatibility placeholder paths render pixelated; removing the marker restores normal rendering.
- The responsive suite preserves all 13 light fixture names and controls and adds 13 deterministic dark baselines only under `e2e/tests/home-responsive.spec.ts-snapshots/`. The active dark logo is selected by rendered dimensions so the test measures the visible brand asset in both themes.
- Computed-style and screenshot evidence proved no compatibility declaration was redundant. Legacy `--pico-*`, CRT/JRPG, default-shell, square-geometry, product/detail placeholder consumers, and Wave 1 routes were preserved.

### TDD Cycle Evidence

| Task             | RED                                                                                                                                                            | GREEN                                                                                      | TRIANGULATE                                                                                                                                     | REFACTOR                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Image policy     | Added the image-policy contract test before CSS; it failed first for the canonical marker and then for both Home aliases as cascade specificity was corrected. | 3/3 focused contract tests passed.                                                         | Covers real product, approved brand, marker removal, canonical marker, and two legacy Home aliases.                                             | No duplicate compatibility declaration was proven removable.                                  |
| Dark Home matrix | Added dark cases before CSS; the unchanged 13 light cases passed and all 13 dark cases failed only because their deterministic baselines did not exist.        | 26/26 responsive cases passed after the focused spec generated the allowed dark baselines. | Every established viewport runs in light and dark with unchanged locale, timezone, DPR, motion, font, image-readiness, and screenshot controls. | Extracted the theme loop and selected the rendered logo without changing light fixture names. |

### Verification

- `pnpm --filter e2e exec playwright test tests/wave0-system-contract.spec.ts` — 3 passed. An initial safety-net invocation failed before execution because port 3032 was occupied; the subsequent exact invocation established the 2/2 baseline. RED execution was also initially blocked by that transient port conflict, then captured through the cascade failures before GREEN.
- `pnpm --filter e2e exec playwright test tests/home-responsive.spec.ts` — 26 passed: 13 unchanged light screenshots and 13 dark equivalents.
- `pnpm --filter e2e exec playwright test tests/home-product-loading.spec.ts` — 3 passed: success, empty, and error behavior preserved.
- `pnpm --filter frontend test` — 283 passed; `pnpm --filter frontend check` — 0 errors, 0 warnings; `PUBLIC_API_URL=http://localhost:3032 pnpm --filter frontend build` — 17 pages built.
- Impeccable detector ran exactly once after UI edits: `impeccable detect --json` over the four changed stylesheets returned `[]`.
- WCAG-oriented focus/contrast/semantics evidence remains in the 0A contract results; the local 44×44 CSS-pixel measurements remain separately asserted in both the foundation contract and Home responsive suite. `pnpm test:all` is deferred because this slice explicitly prohibits unrestricted E2E execution.

### Workload and rollback

After removing incidental formatter changes, the current 0B working diff from committed 0A is 139 additions and 37 deletions (176 textual changed lines), including OpenSpec bookkeeping; the implementation, test, and style portion is 94 additions and 28 deletions (122 lines). The 13 new permitted PNG baselines are binary evidence. The complete 0B work unit remains below the 400-line review budget. Reverting 0B removes only its reset, Home aliases, tests, and dark baselines, preserving 0A semantic foundations. Reverting 0A after 0B restores legacy imports/styles; neither rollback affects data, APIs, routing, content, or route state behavior.

### Parent lifecycle completion

The parent inspected native review authority for the final Wave 0 candidate. Review integration is disabled at clone level; inspection returned `rdd_disabled`, no review lineage was created, and no approval or delivery authority is claimed. Both parent-owned lifecycle rows are marked complete in `tasks.md` as an explicit disabled-review outcome.

### Remaining tasks

No implementation-owned or parent-owned rows remain unchecked. Technical SDD verification remains the next lifecycle phase; this does not claim native review approval.
