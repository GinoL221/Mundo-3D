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

### Remaining Tasks (after PR1)
- [x] Phase 2 (PR2): env-preflight + render.yaml + RUNBOOKS §4 — see below
- [ ] Phase 3 (PR3): backend R2 storage cut-over (atomic, `size:exception`)

---

## Batch: PR2 — Preflight, render.yaml, RUNBOOKS (Phase 2)

Branch: `feat/object-storage-preflight-runbook` (off `main` @ `a0db735`, PR1 merged).
**Implemented inline by the orchestrator** — the delegated `sdd-apply` subagent hit a model-provider session rate limit (HTTP 429) before making any change; its dangling ledger attempt was settled `interrupted` and a fresh attempt acquired.

### Completed Tasks
- [x] 2.1 RED: `scripts/deploy/env-preflight.test.js` — the exact-`REQUIRED`-list assertion extended to expect the 5 R2 vars, plus a parametrised loop adding, per R2 var: a `checkEnv` "in missing not warnings" case and a real-subprocess "exits non-zero and names it" case (10 new cases). Ran `pnpm test:deploy-scripts` → RED, R2 cases failed (vars not in `REQUIRED`).
- [x] 2.2 GREEN: appended `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` to `REQUIRED` in `scripts/deploy/env-preflight.js` after `DB_CA_CERT`, with a comment explaining `R2_ENDPOINT` is the explicit S3 API endpoint (provider-portable).
- [x] 2.3 REFACTOR: no formatting change needed — the existing `missing.join(', ')` FAIL message and `checkEnv` filter cover the new vars unchanged.
- [x] 2.4 `render.yaml` — 5 R2 keys added as `sync: false`, grouped with a comment pointing at RUNBOOKS §4. Total `sync: false` keys now 16.
- [x] 2.5 `docs/RUNBOOKS.md` — new "### 4. Cloudflare R2 — object storage for admin-uploaded images" (account enablement + payment-method caveat, bucket creation, public access r2.dev-vs-custom-domain, bucket-scoped S3 API token → which value maps to which var, API-endpoint-vs-public-host distinction, free-tier ceiling as scaling trigger, end-to-end verification loop). Renumbered "DNS summary" → 5, "First-deploy order" → 6; added R2 as first-deploy step 2 and an image-render check to the final step; added the optional `img.<domain>` row to the DNS summary.
- [x] 2.6 Updated both required-var list mentions in `docs/RUNBOOKS.md`: the "Deploy Pipeline" §2 prose list (`:79`) and the Render §2 env-key list — both now include the 5 R2 vars.
- [x] 2.7 Verified: `pnpm test:deploy-scripts` → 49/49 pass (was 39). `pnpm test` (full backend+frontend) unaffected — see Work Unit Evidence.

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `scripts/deploy/env-preflight.js` | Modified | +5 R2 vars in `REQUIRED` (hard-required, no warn-only) |
| `scripts/deploy/env-preflight.test.js` | Modified | Exact-list assertion + 10 parametrised R2 cases |
| `render.yaml` | Modified | +5 `sync: false` R2 keys |
| `docs/RUNBOOKS.md` | Modified | New §4 Cloudflare R2, renumber §5/§6, +R2 to two required-var lists |

### Deviations from Design
None material. Design guessed the current RUNBOOKS numbering as "DNS 4 / first-deploy 5"; the actual file had DNS as §4 and first-deploy as §5, so R2 slots in as the new §4 and both shift by one — exactly the design's intent.

### Work Unit Evidence
| Evidence | Value |
|---|---|
| Focused test command and result | `pnpm test:deploy-scripts` → 49 tests, 49 pass, 0 fail, exit 0 (10 new R2 cases) |
| Full-suite regression | `pnpm test` → backend + frontend unchanged (no code path in either reads these vars yet; env-preflight is a `node:test` script outside `pnpm test`) |
| Runtime harness | N/A — no real R2 call in PR2; nothing but a var list and docs. Real bucket verification is a PR3/bring-up concern. |
| Rollback boundary | Revert the 4 files; independent of PR1 and PR3, no schema/backend runtime change |

### Status
7/7 PR2 tasks complete (Phase 2 of 3). Ready for PR3 (backend cut-over) or sdd-verify.
