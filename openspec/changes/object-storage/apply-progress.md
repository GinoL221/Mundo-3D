# Apply Progress: object-storage

## Mode
Strict TDD (RED → GREEN → REFACTOR)

## Batch: PR1 — Frontend Resolution Helper (Phase 1)

Branch: `feat/object-storage-image-url-resolution` (off `main` @ `3ebf84f`+CSS-removal follow-through)

### Completed Tasks
- [x] 1.1 RED: `frontend/src/lib/imageUrl.test.ts` written first — 12 cases (http/https pass-through, case-insensitive scheme match, bare filename → `/img/products/...` and `/img/users/...`, null/undefined/empty/whitespace → `''`, protocol-relative `//evil/x` and `javascript:` scheme fall back to legacy prefix)
- [x] 1.2 GREEN: `frontend/src/lib/imageUrl.ts` — `resolveImageUrl(image, kind)` implemented per design's exact rule
- [x] 1.3 REFACTOR: implementation is a single regex + two early returns; colocated with `imageUrl.test.ts` matching the `config.ts`/`config.test.ts` pattern; no further extraction needed
- [x] 1.4 `ProductSearch.astro:154` (now :155 after import line) wired to `resolveImageUrl(product.image, 'products')`
- [x] 1.5 `pages/product.astro:115` (now :116) wired to `resolveImageUrl(product.image, 'products')`
- [x] 1.6 `pages/index.astro:188` (now :189) wired to `resolveImageUrl(product.image, 'products')`
- [x] 1.7 `CartList.astro:118` (now :119) wired to `resolveImageUrl(item.image, 'products')`
- [x] 1.8 `scripts/sessionUI.ts:66` (now :67) wired to `resolveImageUrl(user.image || user.Image, 'users')`
- [x] 1.9 Verified: `pnpm test` (frontend vitest) green — 200/200 tests, 16/16 files. `node backend/tools/architecture/check.js` exit 0, no new domain-locality violation. `rg` sweep confirms zero remaining inline `` `/img/{products,users}/${...}` `` construction anywhere in `frontend/src`.

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `frontend/src/lib/imageUrl.ts` | Created | `resolveImageUrl(image, kind)` — trimmed-empty/null/undefined → `''`; case-insensitive `http(s)://` prefix → as-is; else `/img/${kind}/${image}` |
| `frontend/src/lib/imageUrl.test.ts` | Created | 12 vitest cases incl. adversarial protocol-relative and `javascript:` scheme cases from the design's threat matrix |
| `frontend/src/domains/products/components/ProductSearch.astro` | Modified | Import + call-site swap at the product-card image render |
| `frontend/src/pages/product.astro` | Modified | Import + call-site swap at the product-detail image render |
| `frontend/src/pages/index.astro` | Modified | Import + call-site swap at the homepage product-card image render |
| `frontend/src/domains/cart/components/CartList.astro` | Modified | Import + call-site swap at the cart-item image render |
| `frontend/src/scripts/sessionUI.ts` | Modified | Import + call-site swap at the navbar avatar render (`kind: 'users'`) |

### TDD Cycle Evidence

| Task | RED (test written first) | GREEN (implementation passes) | REFACTOR |
|------|---------------------------|-------------------------------|----------|
| `resolveImageUrl` | `imageUrl.test.ts` created before `imageUrl.ts` existed; `pnpm test -- imageUrl` failed with `Cannot find module './imageUrl'` (1 failed suite / 189 unrelated tests still passed) | `imageUrl.ts` implemented; re-run: 200/200 tests, 16/16 files passed | Implementation reviewed — already minimal (regex + 2 early returns); no changes needed |
| 5 call sites | Not independently unit-tested (no existing per-file test suite covers `<img>` DOM wiring in these `.astro`/`.ts` files — pre-existing gap, not introduced here); behavior-neutral swap verified via full suite green + manual code diff review confirming each site's fallback branch reproduces prior string construction exactly | Full frontend suite green after all 5 edits | N/A — mechanical swap, no further tidy needed |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm --filter frontend test -- imageUrl` → `imageUrl.test.ts`: 12/12 passed; full run: 200/200 tests, 16/16 files |
| Runtime harness command/scenario and exact result | N/A — pure function, unit-tested; no backend dependency in PR1 (per tasks.md Suggested Work Units row 1) |
| Rollback boundary | Revert `frontend/src/lib/imageUrl.ts` + `imageUrl.test.ts` + the 5 call-site diffs; independent of PR2/PR3, no schema or backend change |

### Deviations from Design
None — implementation matches design.md's "Decision: `resolveImageUrl` lives at `frontend/src/lib/imageUrl.ts`" exactly (signature, empty-string rule, case-insensitive scheme match, legacy-prefix fallback for protocol-relative/non-http(s) schemes).

### Issues Found
None introduced by this batch. Noted (out of scope, pre-existing): `frontend/src/pages/product.astro:12` has an empty `src=""` placeholder `<img>` in the static template (filled by the `<script>` block at runtime) — flagged by the local design-quality hook as `broken-image:12`; this predates PR1 and is unrelated to the `resolveImageUrl` wiring, so it was left untouched per the assigned task scope.

### Remaining Tasks
- [ ] Phase 2 (PR2): env-preflight + render.yaml + RUNBOOKS §4
- [ ] Phase 3 (PR3): backend R2 storage cut-over (atomic, `size:exception`)

### Workload / PR Boundary
- Mode: chained PR slice (stacked-to-main)
- Current work unit: Unit 1 — Frontend `resolveImageUrl` + 5 call sites (PR1)
- Boundary: starts at `main` @ `3ebf84f`+CSS-removal; ends with the 5-call-site wiring, no backend/env/deploy changes
- Estimated review budget impact: ~15 changed lines in call sites + ~55 lines new (`imageUrl.ts` + `imageUrl.test.ts`) — well under the 400-line budget, no exception needed

### Status
9/9 PR1 tasks complete (Phase 1 of 3). Ready for next batch (PR2) or sdd-verify on this slice.
