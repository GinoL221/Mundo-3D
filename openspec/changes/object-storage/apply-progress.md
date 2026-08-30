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

---

## Batch: PR3 — Backend R2 Cut-Over (Phase 3, atomic, `size:exception`)

Branch: `feat/object-storage-r2-cutover` (off `main` @ `d3133e4`, PR1 + PR2 merged).
`size:exception` accepted by the user before this apply run (design.md Review Workload note; tasks.md forecast "Decision needed before apply: No").

**Actual authored changed lines: ~723** (excl. `pnpm-lock.yaml`, which is generated: +305). Split ~241 production / ~482 test+types. This exceeds the design's ~470 estimate (~220 prod / ~250 test); production landed on target, the test surface came in ~230 lines heavier. Overage drivers: the `r2StorageEngine` unit suite is 166 lines (7 cases incl. the adversarial `.png.exe` row and the stream-`limit` row); two regression-repair test edits the design did not budget — `SequelizeUserRepository.integration.test.ts` (+49/−26, adapted disk→R2 assertions) and `routes/api/__tests__/products.test.ts` (+19, S3 transport stub). Still a single atomic PR3 per the design (splitting was rejected: it would land a dead module for one PR against AGENTS.md and break the cut-over into non-atomically-revertible halves).

### Completed Tasks
- [x] 3.1 `@aws-sdk/client-s3` added to `backend/package.json` (`^3.1116.0`); `pnpm install` refreshed `pnpm-lock.yaml`. Only that one dep — `multer-s3` and `@aws-sdk/lib-storage` stay rejected per design.
- [x] 3.2 RED: `storage/__tests__/r2StorageEngine.test.ts` written first — failed with `Cannot find module '../r2StorageEngine'`. 7 cases: dest-namespaced `^products/<uuid>\.<ext>$` key, `ContentType` from mimetype, adversarial `evil.png.exe`+`image/png` still `ContentType: image/png`, `location` = `R2_PUBLIC_URL_BASE`+`/`+key, no `ACL` in the `PutObjectCommand` input, `PutObject` rejection → `cb(error)`, stream `'limit'` → no `PutObjectCommand` + `cb(Error)`, `_removeFile` sends `DeleteObjectCommand` with the recorded key.
- [x] 3.3 GREEN: `storage/r2Client.ts` — lazy `S3Client` singleton (`region:'auto'`, explicit `endpoint`, `credentials` from env), `getR2Client()` / `getBucket()` / `publicUrlFor(key)` (trailing-slash-stripped base + `/` + key) / `resetR2Client()` test seam.
- [x] 3.4 GREEN: `storage/r2StorageEngine.ts` — `R2StorageEngine` class + `createR2StorageEngine(dest)` factory. `_handleFile` buffers `file.stream` (already bounded by multer's 5MB `limits.fileSize`), one `PutObjectCommand` with `Bucket/Key/Body/ContentType/ContentLength`, callback `{ key, bucket, location, size }`; a `settled` guard prevents double-callback. `'limit'` → fail before any `PutObject`. `'error'` → fail. `_removeFile` issues `DeleteObjectCommand({ Bucket, Key: file.key })`. No `ACL` field anywhere.
- [x] 3.5 REFACTOR: both files already minimal + commented; extracted the `fail()` guard helper in `_handleFile`. `npx eslint` clean; `r2Client.ts` 38 lines, `r2StorageEngine.ts` 100 lines (both well under the 250 cap).
- [x] 3.6 RED: `utils/__tests__/cleanupUploadedFile.test.ts` rewritten — failed against the `fs.unlink`/`filePath` implementation. 4 cases: falsy key (`undefined`/`null`/`''`) → no `send`; present key → exactly one `DeleteObjectCommand` with `{ Bucket, Key }`; rejection → `logger.warn({ event:'upload_cleanup_failed', key, bucket })` and never throws (no unhandled rejection); returns `undefined` synchronously.
- [x] 3.7 GREEN: `utils/cleanupUploadedFile.ts` — signature `cleanupUploadedFile(key: string | undefined | null): void`. Falsy → early return; present key ALWAYS issues `DeleteObjectCommand` (kills the silent-no-op regression). `.catch` → `logger.warn` with the load-bearing `upload_cleanup_failed` event, raw `error`, plus the existing message string. Never throws, never returns an awaitable.
- [x] 3.8 RED: `middlewares/__tests__/upload.test.ts` rewritten — failed on `multer.diskStorage is not a function`. Asserts `createR2StorageEngine('products')` is called, `storage` exposes `_handleFile`/`_removeFile`, `limits` stays `{ fileSize: 5*1024*1024 }`, `multer.diskStorage` is gone, `fileFilter` still rejects `notes.txt`/`text/plain` with the exact message and accepts `avatar.png`/`image/png`.
- [x] 3.9 GREEN: `middlewares/upload.ts` — `multer.diskStorage({...})` → `createR2StorageEngine(dest)`; dropped `fs` + `path.join`/`mkdirSync` destination code; `fileFilter` and `limits` verbatim; hand-declared `MulterFile`/`MulterInstance` kept (no `@types/multer`).
- [x] 3.10 RED: `ProductApiController.test.ts` — `req.file` shape → `{ key, location }`; create/update now assert `image` = `req.file.location` (full `https://pub-test.r2.dev/...` URL) forwarded to the use case, and the 404 path calls `cleanupUploadedFile(req.file.key)`. Failed against `.filename`/`.path`.
- [x] 3.11 GREEN: `ProductApiController.ts` — local type → `{ file?: { key: string; location: string } }`; `create` `image: req.file?.location ?? null`; `update` `if (req.file?.location) input.image = req.file.location`; 404 cleanup `if (req.file?.key) cleanupUploadedFile(req.file.key)`; comment updated disk→bucket.
- [x] 3.12 RED: `UserApiController.test.ts` (register handler) — `req.file` → `{ key, location }`; asserts `RegisterUserUseCase.execute` gets `image: <location URL>` and the `UserAlreadyExistsException` path calls `cleanupUploadedFile(req.file.key)`. Failed against `.filename`/`.path`.
- [x] 3.13 GREEN: `UserApiController.ts` — register `req` type → `{ file?: { key: string; location: string } }`; `const image = req.file.location`; catch-branch cleanup → `req.file.key`.
- [x] 3.14 RED: `handleValidationErrors.test.ts` — orphan-cleanup case now sets `req.file = { key: 'products/orphan-uuid.png' }` and expects `cleanupUploadedFile('products/orphan-uuid.png')`. Failed against `.path`.
- [x] 3.15 GREEN: `handleValidationErrors.ts` — `RequestWithFile` → `{ file?: { key?: string } }`; `if (req.file?.key) cleanupUploadedFile(req.file.key)`; comment updated disk→bucket.
- [x] 3.16 REFACTOR: `rg` sweep of the three call-site files → zero remaining `req.file.path` / `req.file.filename`. Only other repo hits were `src/types/express.d.ts` (updated, see Deviations) and `SequelizeUserRepository.integration.test.ts` (adapted, see below).
- [x] 3.17 Verify: `pnpm test` → **backend 945/945 (115 suites), frontend 200/200 (16 files), exit 0**. `npx tsc --noEmit` clean, `npx eslint` clean on all changed files, `node backend/tools/architecture/check.js` exit 0. Real-bucket integration is **NOT** exercised in CI — every S3 call is mocked (`S3Client` replaced, `send` stubbed). Accepted gap, mirroring `platform-provisioning`'s Aiven TLS handshake gap; closed only by the manual RUNBOOKS §4 verification loop at bring-up. No MinIO/localstack (design rejected it).

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `backend/package.json` | Modified | `+@aws-sdk/client-s3@^3.1116.0` |
| `pnpm-lock.yaml` | Modified (generated) | Lockfile refresh for the new dep (+305) |
| `backend/src/infrastructure/storage/r2Client.ts` | Created | Lazy `S3Client` singleton + `getBucket`/`publicUrlFor`/`resetR2Client` (38 lines) |
| `backend/src/infrastructure/storage/r2StorageEngine.ts` | Created | `R2StorageEngine` (`_handleFile`/`_removeFile`) + `createR2StorageEngine` factory (100 lines) |
| `backend/src/infrastructure/storage/__tests__/r2StorageEngine.test.ts` | Created | 7 Jest cases, S3 transport mocked (166 lines) |
| `backend/src/infrastructure/middlewares/upload.ts` | Modified | `diskStorage` → `createR2StorageEngine(dest)`; dropped `fs`/`path.join` dest code; `fileFilter`/`limits` verbatim |
| `backend/src/infrastructure/middlewares/__tests__/upload.test.ts` | Modified | Rewritten for the engine swap (engine wiring, 5MB limit, `fileFilter` preserved, no `diskStorage`) |
| `backend/src/infrastructure/utils/cleanupUploadedFile.ts` | Modified | `fs.unlink(path)` → `DeleteObjectCommand(key)`; never-throw / non-await contract + `upload_cleanup_failed` event preserved |
| `backend/src/infrastructure/utils/__tests__/cleanupUploadedFile.test.ts` | Modified | Rewritten for the `(key)` signature — falsy/success/rejection-warn/no-throw |
| `backend/src/infrastructure/controllers/ProductApiController.ts` | Modified | Local file type; `create`/`update` `image` = `req.file.location`; 404 cleanup by `req.file.key` |
| `backend/src/infrastructure/controllers/__tests__/ProductApiController.test.ts` | Modified | `req.file` → `{ key, location }`; `.location`→`image` and 404 `.key` cleanup assertions |
| `backend/src/infrastructure/controllers/UserApiController.ts` | Modified | register file type; `image` = `req.file.location`; `UserAlreadyExistsException` cleanup by `req.file.key` |
| `backend/src/infrastructure/controllers/__tests__/UserApiController.test.ts` | Modified | `req.file` → `{ key, location }`; `.location`/`.key` contract assertions |
| `backend/src/infrastructure/middlewares/handleValidationErrors.ts` | Modified | Third cleanup call site → `req.file.key` |
| `backend/src/infrastructure/middlewares/__tests__/handleValidationErrors.test.ts` | Modified | Orphan-cleanup case → `req.file.key` |
| `backend/src/types/express.d.ts` | Modified | `Express.Request.file`: added `key`/`location` (required) + `bucket?`; removed the disk-only `filename`/`path`/`destination` (see Deviations) |
| `backend/src/infrastructure/repositories/__tests__/SequelizeUserRepository.integration.test.ts` | Modified | Adapted the real-DB register-race test disk→R2: `req.file` shape, `S3Client` mock, `waitUntilRemoved`(fs) → `waitUntilDeleted`(DeleteObjectCommand). NOT executed here — needs a live DB (`pnpm test:integration`) |
| `backend/src/infrastructure/routes/api/__tests__/products.test.ts` | Modified | Added an `@aws-sdk/client-s3` `S3Client`/`send` stub + R2 env vars so the real upload pipeline no longer makes a network call on the 3 POST-multipart cases |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.2–3.5 engine | `storage/__tests__/r2StorageEngine.test.ts` | Unit (Jest) | N/A (new) | ✅ `Cannot find module '../r2StorageEngine'` | ✅ 7/7 | ✅ 7 cases (key-shape, ContentType, adversarial `.png.exe`, location, no-ACL, PutObject-reject, stream-`limit`, `_removeFile`) | ✅ extracted `fail()` guard; eslint clean |
| 3.6–3.7 cleanup | `utils/__tests__/cleanupUploadedFile.test.ts` | Unit (Jest) | ✅ old 3/3 green first, then rewritten RED (`fs.unlink`/`filePath`) | ✅ Written | ✅ 4/4 | ✅ 4 cases (falsy×3, success, rejection-warn, sync-undefined) | ➖ impl already minimal |
| 3.8–3.9 upload | `middlewares/__tests__/upload.test.ts` | Unit (Jest) | ✅ old 6/6 green first | ✅ `multer.diskStorage is not a function` | ✅ 5/5 | ✅ 5 cases (engine wiring, 5MB limit, no diskStorage, fileFilter reject + accept) | ➖ mechanical swap |
| 3.10–3.11 Product ctrl | `controllers/__tests__/ProductApiController.test.ts` | Unit (Jest) | ✅ 29/29 baseline; 3 RED after edits | ✅ Written | ✅ 32/32 | ✅ create `.location`, update `.location`, 404 `.key` cleanup, success no-cleanup | ➖ none |
| 3.12–3.13 User ctrl | `controllers/__tests__/UserApiController.test.ts` | Unit (Jest) | ✅ 6/8 baseline; 2 RED after edits | ✅ Written | ✅ 8/8 | ✅ register `.location`→image, `UserAlreadyExistsException` `.key` cleanup | ➖ none |
| 3.14–3.15 validation mw | `middlewares/__tests__/handleValidationErrors.test.ts` | Unit (Jest) | ✅ 2/3 baseline; 1 RED after edit | ✅ Written | ✅ 3/3 | ➖ single call site, one behavior | ➖ none |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx jest src/infrastructure/storage src/infrastructure/utils/__tests__/cleanupUploadedFile.test.ts src/infrastructure/middlewares/__tests__/upload.test.ts` and per-file runs above — all green. Full: `pnpm test` → backend **945/945** (115 suites), frontend **200/200** (16 files), exit 0 |
| Runtime harness command/scenario and exact result | No live-R2 boundary reachable in CI (design "Integration (real bucket): Not feasible in CI"). `routes/api/__tests__/products.test.ts` exercises the real Express upload pipeline (multer → `fileFilter` → `R2StorageEngine._handleFile` → callback → controller) with only the S3 `send` stubbed: 28/28 green. `SequelizeUserRepository.integration.test.ts` adapted but requires `pnpm test:integration` + a live DB — **not run in this session**. Real SigV4 / bucket public-access / public-host serving verified only by the manual RUNBOOKS §4 loop at bring-up. |
| Rollback boundary | `git revert` the PR3 commit only, keeping PR1 + PR2 (design Rollback: the frontend `resolveImageUrl` passes absolute URLs through, so rows written during a live window still render after a revert to disk storage). No schema change. Bucket objects written during the window are orphaned-but-harmless. |

### Deviations from Design
1. **`backend/src/types/express.d.ts` updated** — not in the design's File Changes table. The global `Express.Request.file` type still declared the disk-era `filename: string` (required) / `path?` / `destination?`. Left as-is, the local controller intersection types (`Request & { file?: { key; location } }`) would not compile once `filename` was the only required member. Replaced `filename`/`path`/`destination` with `key: string` + `location: string` (required — the engine always sets them) and `bucket?: string`. Pure `.d.ts`, no runtime effect. Matches design intent ("`:12` file type", "`:120` type").
2. **Two regression-repair test edits the design did not budget** — `SequelizeUserRepository.integration.test.ts` and `routes/api/__tests__/products.test.ts` both drive the real upload/cleanup code and broke the moment `diskStorage`/`fs.unlink` were removed. Adapted to the R2 model (S3 `send` stub, `DeleteObjectCommand` assertion) rather than left red. The integration file is outside the default `pnpm test` suite and was not executed here (no live DB).
3. **Changed-line count ~723 authored vs. the design's ~470 estimate** — production ~241 (≈ the ~220 estimate); test+types ~482 (≈ the ~250 estimate + ~230). `size:exception` already accepted; flagged for the reviewer. PR3 kept atomic per design (split was explicitly rejected).

Otherwise matches design exactly: custom `StorageEngine` (no `multer-s3`), `image` = `req.file.location` from `publicUrlFor`, `cleanupUploadedFile` re-keyed not branched, `ContentType` always from the validated mimetype, lazy R2 client singleton, no `ACL` ever sent.

### Issues Found
None blocking. Pre-existing / out-of-scope, unchanged: replacing a product image still orphans the previous bucket object forever (design Open Question — disk leaked identically); `backend/src/app.js:64` `imgSrc: ["'self'"]` would need the R2 host if a backend-rendered page ever displays an upload (design Open Question).

### Status
17/17 PR3 tasks complete (Phase 3 of 3 — all phases done). Ready for `sdd-verify`.
