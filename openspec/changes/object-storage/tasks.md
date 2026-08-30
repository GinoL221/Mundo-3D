# Tasks: object-storage

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~150, PR2 ~130, PR3 ~470 (≈220 prod / ≈250 test) |
| 400-line budget risk | Medium (PR3 only) |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No — user already confirmed PR3's `size:exception` during this session (see design.md Review Workload note).
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Frontend `resolveImageUrl` + 5 call sites | PR 1 | `pnpm --filter frontend test imageUrl` | N/A — pure function, unit-tested; no backend dependency yet | Revert `frontend/src/lib/imageUrl.ts` + 5 call-site diffs independently of PR2/PR3 |
| 2 | Env preflight + render.yaml + RUNBOOKS §4 | PR 2 | `pnpm test:deploy-scripts` | N/A — no live R2 call; verified against process.env fixtures | Revert `env-preflight.js`/`render.yaml`/RUNBOOKS diffs; PR1 unaffected |
| 3 | Backend R2 storage cut-over (atomic, `size:exception`) | PR 3 | `pnpm test` (backend Jest suite) | Manual RUNBOOKS §4 verification loop at bring-up (real bucket infeasible in CI) | Revert PR3 only, keep PR1 — see design.md Rollback |

## Phase 1: PR1 — Frontend Resolution Helper

- [x] 1.1 RED: write `frontend/src/lib/imageUrl.test.ts` — http/https pass-through (case-insensitive), bare filename → `/img/products/...` and `/img/users/...`, null/undefined/whitespace-only → `''`, `//evil/x` and `javascript:` fall back to legacy prefix
- [x] 1.2 GREEN: implement `resolveImageUrl(image, kind)` in `frontend/src/lib/imageUrl.ts` per spec
- [x] 1.3 REFACTOR: tidy implementation/tests, confirm colocated pattern matches `config.ts`/`config.test.ts`
- [x] 1.4 Wire `ProductSearch.astro:154` to call `resolveImageUrl(image, 'products')`
- [x] 1.5 Wire `pages/product.astro:115`
- [x] 1.6 Wire `pages/index.astro:188`
- [x] 1.7 Wire `CartList.astro:118`
- [x] 1.8 Wire `scripts/sessionUI.ts:66` with `'users'` kind
- [x] 1.9 Verify: `pnpm --filter frontend test` green; confirm architecture checker (`.astro` files unscanned per design) raises no new domain-locality violation

## Phase 2: PR2 — Preflight, render.yaml, RUNBOOKS

- [ ] 2.1 RED: add cases to `scripts/deploy/env-preflight.test.js` — missing each of `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` fails; all-set passes
- [ ] 2.2 GREEN: append the 5 R2 vars to `REQUIRED` in `scripts/deploy/env-preflight.js` after `DB_CA_CERT` (`:10`)
- [ ] 2.3 REFACTOR: confirm error-message formatting matches existing entries
- [ ] 2.4 Add the 5 R2 keys as `sync: false` to `render.yaml`
- [ ] 2.5 Add new "4. Cloudflare R2" subsection to `docs/RUNBOOKS.md` (account enablement, bucket creation, public access, bucket-scoped S3 token, var mapping, free-tier ceiling as scaling trigger, verification loop); renumber DNS→5, first-deploy→6
- [ ] 2.6 Update the two required-var lists in `docs/RUNBOOKS.md` (`:79` and `:119-125`) to include the 5 R2 vars
- [ ] 2.7 Verify: `pnpm test:deploy-scripts` green (node:test runner, not `pnpm test`)

## Phase 3: PR3 — Backend R2 Cut-Over (atomic, `size:exception`)

- [ ] 3.1 Add `@aws-sdk/client-s3` to `backend/package.json`
- [ ] 3.2 RED: write `backend/src/infrastructure/storage/__tests__/r2StorageEngine.test.ts` — key matches `^<dest>/<uuid>\.<ext>$`, `ContentType` from mimetype (incl. `.png.exe`-original-still-`image/png` adversarial case), `location` from `R2_PUBLIC_URL_BASE`, no `ACL` sent, `PutObject` rejection → `cb(error)`, stream size-limit hit → no `PutObject`
- [ ] 3.3 GREEN: create `backend/src/infrastructure/storage/r2Client.ts` — lazy `S3Client` singleton (`region: 'auto'`), `getR2Client()`, `getBucket()`, `publicUrlFor()`, `resetR2Client()`
- [ ] 3.4 GREEN: create `backend/src/infrastructure/storage/r2StorageEngine.ts` — `_handleFile` (buffer stream bounded by 5MB `limits.fileSize`, one `PutObjectCommand`), `_removeFile` (`DeleteObjectCommand`)
- [ ] 3.5 REFACTOR: tidy `r2Client.ts`/`r2StorageEngine.ts`
- [ ] 3.6 RED: rewrite `backend/src/infrastructure/utils/__tests__/cleanupUploadedFile.test.ts` for new `cleanupUploadedFile(key)` signature — falsy key early-returns, success issues one `DeleteObjectCommand`, rejection logs `upload_cleanup_failed` warn and never throws
- [ ] 3.7 GREEN: modify `backend/src/infrastructure/utils/cleanupUploadedFile.ts` — accept `key`, send `DeleteObjectCommand`, `.catch` logs `{event:'upload_cleanup_failed', key, bucket, error}`
- [ ] 3.8 RED: extend `backend/src/infrastructure/middlewares/__tests__/upload.test.ts` — `fileFilter` and `limits.fileSize === 5MB` unchanged after the engine swap
- [ ] 3.9 GREEN: modify `backend/src/infrastructure/middlewares/upload.ts` — `diskStorage` → `createR2StorageEngine(dest)`, drop `fs`/`path.join` destination code, keep `fileFilter`/`limits` verbatim
- [ ] 3.10 RED: extend `ProductApiController.test.ts` — persisted `image` = `req.file.location`; every failure path cleans by `req.file.key`
- [ ] 3.11 GREEN: modify `backend/src/infrastructure/controllers/ProductApiController.ts` (`:12` type, `:94` + `:142` → `.location`, `:157-158` → `.key`)
- [ ] 3.12 RED: extend `UserApiController.test.ts` (registration handler) — same `.location`/`.key` contract
- [ ] 3.13 GREEN: modify `backend/src/infrastructure/controllers/UserApiController.ts` (`:120` type, `:135` → `.location`, `:172-173` → `.key`)
- [ ] 3.14 RED: add/extend a `handleValidationErrors` test asserting cleanup uses `req.file.key`
- [ ] 3.15 GREEN: modify `backend/src/infrastructure/middlewares/handleValidationErrors.ts` (`:18-19` → `.key`)
- [ ] 3.16 REFACTOR: sweep the three call-site files for any remaining `.path` reference on `req.file`; confirm none remain
- [ ] 3.17 Verify: `pnpm test` (backend Jest suite) green; note explicitly that real-bucket integration is not feasible in CI (mock `S3Client.prototype.send`) — accepted gap mirroring `platform-provisioning`'s Aiven TLS gap, closed only by the manual RUNBOOKS §4 loop at bring-up

## Non-goals (no tasks)

Image transformations/resizing/CDN; migrating seed images into the bucket; changing `fileFilter` rules or the 5MB limit; upload UI/UX changes; automating Cloudflare account/bucket provisioning; data migration (no real admin-uploaded rows exist); splitting PR3.
