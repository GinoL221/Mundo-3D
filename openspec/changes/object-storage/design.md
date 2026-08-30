# Design: object-storage

Traceability: proposal `openspec/changes/object-storage/proposal.md` (Engram #6923, questions RESOLVED) · exploration #6921 · prior art `openspec/changes/archive/2026-08-30-platform-provisioning/design.md` (env-preflight required-var pattern, RUNBOOKS bring-up style).

## Technical Approach

Replace `multer.diskStorage` with a **hand-written multer `StorageEngine`** over `@aws-sdk/client-s3` pointed at R2. `fileFilter` and `limits` in `upload.ts` are untouched (multer-level, provider-independent). The engine returns `{ key, bucket, location, size }`; `location` is built from `R2_PUBLIC_URL_BASE`, so `image` persists a full public URL and the cross-origin `<img>` bug disappears as a side effect. Cleanup switches from `fs.unlink(path)` to `DeleteObjectCommand(key)`. The frontend gains one shared `resolveImageUrl` used by all five `<img>` sites. Preflight, `render.yaml`, and RUNBOOKS follow the `DB_PORT`/`DB_CA_CERT` precedent exactly.

## Architecture Decisions

### Decision: custom `StorageEngine`, not `multer-s3`

**Choice**: `backend/src/infrastructure/storage/r2StorageEngine.ts` — `_handleFile` buffers `file.stream` (bounded by the existing 5 MB `limits.fileSize`), then one `PutObjectCommand` with `Body`, `ContentType: file.mimetype`, `ContentLength`. `_removeFile` issues `DeleteObjectCommand`. Only `@aws-sdk/client-s3` is added.
**Alternatives**: `multer-s3@3` (+ `@types/multer-s3`); `@aws-sdk/lib-storage` `Upload`.
**Rationale**: four concrete blockers, not preference. (1) `multer-s3`'s `.location` is derived from the S3 API endpoint — for R2 that is `https://<account>.r2.cloudflarestorage.com/...`, which requires SigV4 auth and is **not** publicly readable, so the field we most need would be wrong. (2) `multer-s3` sends `ACL` by default; R2 has no per-object ACLs (access is bucket-level). (3) `@types/multer-s3` pulls `@types/multer`, which this repo deliberately avoids — `upload.ts:7-18` hand-declares `MulterFile`/`MulterInstance` and casts. (4) `multer-s3` is effectively unmaintained. `lib-storage` is rejected as a second dependency: S3 multipart's minimum part size is 5 MB, exactly our ceiling, so multipart can never engage.

### Decision: `image` = `req.file.location`, composed from `R2_PUBLIC_URL_BASE`

**Choice**: `publicUrlFor(key) = R2_PUBLIC_URL_BASE.replace(/\/$/, '') + '/' + key`, exposed as `.location`. Controllers read `.location` (not `.key`).
**Alternatives**: persist `.key` and compose the URL in the frontend; use an engine-derived `.location`.
**Rationale**: composing in the frontend would require shipping the bucket host to Astro as a second build-time var and would re-break every consumer that reads `image` directly (API clients, session cookie payload at `UserApiController:152-157`). One absolute URL in the column is self-describing and provider-portable. The base is a separate var from the endpoint because R2's public host (`pub-<hash>.r2.dev` or a custom domain) is never the S3 API host.

### Decision: `cleanupUploadedFile` is re-keyed, not branched

**Choice**: signature becomes `cleanupUploadedFile(key: string | undefined | null)`; body sends `DeleteObjectCommand`, `.catch` logs `logger.warn({ event: 'upload_cleanup_failed', key, bucket, error })`. Never throws, never returns a promise callers must await — the existing contract (`:4-8`) is preserved verbatim. All three call sites move `req.file?.path` → `req.file?.key`.
**Alternatives**: keep `.path` and branch on file shape; new `deleteUploadedObject` alongside the old function.
**Rationale**: disk storage is fully removed, so a branch would be permanently dead. Keeping the name and the `upload_cleanup_failed` event keeps any log-based alerting working. A falsy key still returns early (legitimately no file); a present key **always** issues the delete, which is the silent-no-op regression the proposal (Q3) exists to prevent.

### Decision: `resolveImageUrl` lives at `frontend/src/lib/imageUrl.ts`

**Choice**: `resolveImageUrl(image: string | null | undefined, kind: 'products' | 'users'): string`. Trimmed-empty/null → `''`; case-insensitive `http://`/`https://` prefix → returned as-is; anything else → `/img/${kind}/${image}`.
**Alternatives**: match `R2_PUBLIC_URL_BASE`; extend `product.adapter.ts`; duplicate inline.
**Rationale**: scheme-matching keeps the frontend ignorant of a backend env var and survives the Backblaze fallback. `product.adapter.ts` is products-domain-local, but `sessionUI.ts` (avatars) and `CartList.astro` also need it. Protocol-relative (`//host/x`) and every non-http(s) scheme deliberately fall through to the legacy prefix — a broken image, never an attacker-chosen scheme in `src`.
**Constraint**: `backend/tools/architecture/engine.js:56` (`frontend.domain.locality`) allows a `.ts` under `frontend/src/domains/` to import only its own domain or `frontend/src/config.ts`. `.astro` files are not scanned (`check.js:19` regex excludes them), so the four `.astro` sites and `scripts/sessionUI.ts` are clean. A future domain-level `.ts` importing this helper would violate the rule and must amend the allowlist deliberately.

### Decision: `ContentType` always set explicitly from the validated mimetype

**Choice**: `PutObjectCommand.ContentType = file.mimetype`; key = `${dest}/${uuidv4()}${path.extname(originalname)}`.
**Rationale**: `fileFilter`'s `/jpeg|jpg|png|gif|webp/` is unanchored (`upload.ts:47-49`), so `evil.png.exe` passes when the mimetype also matches — pre-existing, now amplified because the key would sit on a public domain. Setting `ContentType` explicitly means the public host serves it as `image/*` regardless of the key suffix. The uuid prefix means `originalname` never controls a path segment (`path.extname` operates on the basename and cannot contain `/`).

### Decision: lazy R2 client singleton

**Choice**: `backend/src/infrastructure/storage/r2Client.ts` — `getR2Client()` constructs `new S3Client({ region: 'auto', endpoint: R2_ENDPOINT, credentials: {...} })` on first use and caches it; plus `getBucket()`, `publicUrlFor()`, `resetR2Client()` for tests.
**Rationale**: `createUpload('products')` runs at module load (`routes/api/products.ts:50`), so reading env at construction time would break every test importing the router. Same lazy discipline the `config.js` precedent forced.

## Data Flow

    POST /api/products (multipart)
      └─ multer: limits(5MB) → fileFilter(ext+mime) → r2StorageEngine._handleFile
                                                        │ buffer stream
                                                        └─ PutObject(key=products/<uuid>.png)
      └─ req.file = { key, bucket, location, size }
      └─ validators → controller → image = req.file.location ──► DB (full URL)
                          │ 404 / validation / duplicate-user
                          └─ cleanupUploadedFile(req.file.key) ──► DeleteObject (warn on failure)

    Browser (Vercel) ── resolveImageUrl(image, 'products')
        absolute? ──► https://<R2 public host>/products/<uuid>.png   (new rows)
        else      ──► /img/products/<seed>.jpg                        (seed rows, unchanged)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/infrastructure/storage/r2Client.ts` | Create | Lazy `S3Client` singleton, bucket + `publicUrlFor` helpers |
| `backend/src/infrastructure/storage/r2StorageEngine.ts` | Create | `_handleFile` / `_removeFile` multer engine |
| `backend/src/infrastructure/middlewares/upload.ts` | Modify | `diskStorage` → `createR2StorageEngine(dest)`; drop `fs`/`path.join` destination; `fileFilter`/`limits` verbatim |
| `backend/src/infrastructure/utils/cleanupUploadedFile.ts` | Modify | `fs.unlink(path)` → `DeleteObjectCommand(key)` |
| `backend/src/infrastructure/controllers/ProductApiController.ts` | Modify | `:12` file type, `:94` + `:142` → `.location`, `:157-158` → `.key` |
| `backend/src/infrastructure/controllers/UserApiController.ts` | Modify | `:120` type, `:135` → `.location`, `:172-173` → `.key` (the real `users.ts` registration handler) |
| `backend/src/infrastructure/middlewares/handleValidationErrors.ts` | Modify | `:18-19` → `.key` (third cleanup site, not listed in the proposal) |
| `backend/package.json` | Modify | `+@aws-sdk/client-s3` |
| `frontend/src/lib/imageUrl.ts` | Create | `resolveImageUrl` |
| `ProductSearch.astro:154`, `product.astro:115`, `index.astro:188`, `CartList.astro:118`, `sessionUI.ts:66` | Modify | Call the helper |
| `scripts/deploy/env-preflight.js` | Modify | `REQUIRED` += 5 R2 vars, appended after `DB_CA_CERT` (`:10`) as a third group |
| `render.yaml` | Modify | 5 keys with `sync: false` (**scope addition** — the proposal omitted it; without it the blueprint inventory drifts) |
| `docs/RUNBOOKS.md` | Modify | New "4. Cloudflare R2" subsection (renumber DNS→5, first-deploy→6); update the required-var lists at `:79` and `:119-125` |

## Interfaces / Contracts

| Var | Gate | Source at bring-up |
|-----|------|--------------------|
| `R2_ENDPOINT` | REQUIRED | Shown on R2's API-token screen (`https://<account>.r2.cloudflarestorage.com`) — explicit, not derived from an account id, so the Backblaze fallback is a value swap |
| `R2_ACCESS_KEY_ID` | REQUIRED | R2 → Manage API tokens → Object Read & Write, bucket-scoped |
| `R2_SECRET_ACCESS_KEY` | REQUIRED | Same token, shown once |
| `R2_BUCKET_NAME` | REQUIRED | Bucket name |
| `R2_PUBLIC_URL_BASE` | REQUIRED | Public host, **no trailing slash** — `pub-<hash>.r2.dev` (pre-launch) or a custom domain (production) |

`region: 'auto'` is a constant, not a var. No ACL is ever sent.

RUNBOOKS §4 outline: enable R2 on the Cloudflare account (verify at bring-up whether activation still requires a payment method on file even inside the free tier) → create the bucket → enable public access (r2.dev managed subdomain vs. custom domain, and that a custom domain requires the zone on Cloudflare DNS) → create the bucket-scoped S3 API token → map each of the five values to its var → set them in Render → free-tier ceiling (10 GB, 1M Class A / 10M Class B ops per month, zero egress) as an explicit scaling trigger → verification loop (upload via admin form → object visible in the dashboard → persisted URL opens in a browser → redeploy Render → image still renders).

## Testing Strategy

Strict TDD is active (`openspec/config.yaml: testing.strict_tdd: true`). RED before GREEN for every row.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (vitest) | `resolveImageUrl`: http/https pass-through, bare filename → `/img/products/` and `/img/users/`, null/undefined/empty/whitespace → `''`, `//evil/x` and `javascript:` fall back to the legacy prefix | new `frontend/src/lib/imageUrl.test.ts` (colocated, matching `config.ts`/`config.test.ts`) |
| Unit (Jest) | `_handleFile`: key matches `^products/<uuid>\.png$`, `ContentType` from mimetype, `location` from `R2_PUBLIC_URL_BASE`, no `ACL`; `PutObject` rejection → `cb(error)`; stream `'limit'` → no `PutObject` issued | new `storage/__tests__/r2StorageEngine.test.ts`; `S3Client.prototype.send` mocked |
| Unit (Jest) | `_removeFile` sends `DeleteObjectCommand` with the recorded key | same file |
| Unit (Jest) | `cleanupUploadedFile`: falsy → no send; success → exactly one `DeleteObjectCommand`; rejection → `logger.warn` with `event: 'upload_cleanup_failed'`, never throws, no unhandled rejection | rewrite `utils/__tests__/cleanupUploadedFile.test.ts` |
| Unit (Jest) | `fileFilter` still rejects bad ext/mime and `limits.fileSize === 5MB` after the engine swap | extend `middlewares/__tests__/upload.test.ts` |
| Unit (Jest) | Controllers persist `.location`; every 404 / validation / `UserAlreadyExistsException` path cleans by `.key` | extend `ProductApiController.test.ts`, `UserApiController.test.ts` |
| Unit (node:test) | `checkEnv` reports all five R2 vars in `missing` | `scripts/deploy/env-preflight.test.js` via root `test:deploy-scripts` — **not** Jest |
| Integration (real bucket) | **Not feasible in CI.** Live Cloudflare credentials cannot be committed and a bucket cannot be provisioned per-run; every S3 call is mocked | stated as an accepted gap, mirroring the Aiven TLS handshake gap in `platform-provisioning` |
| Manual (once, at bring-up) | What mocks cannot prove: real SigV4 signing against R2's endpoint, bucket public-access configuration, the public host actually serving the object, and any R2-vs-S3 behavioral divergence | RUNBOOKS §4 verification loop |

A MinIO/localstack docker service was considered and rejected: it would re-prove SDK wiring the mocks already cover while still not being R2, at real maintenance cost.

## Threat Matrix

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | N/A | No file classification or execution-by-extension logic authored. |
| Shell / subprocess | N/A | No command execution added. |
| Git repository selection / commit / push / PR | N/A | No VCS automation authored. |
| Routing | N/A | No route, method, or guard changes — only handler bodies. |
| **Attacker-controlled filename → object key + served content type** | **Applicable** | `originalname` reaches the key suffix and the file lands on a public host. Safe behavior: uuid-prefixed key (no path segment is attacker-controlled), `ContentType` always from the validated mimetype, never inferred from the key. RED tests: the `_handleFile` key-shape and `ContentType` cases above, plus a case asserting a `.png.exe` original still yields `ContentType: image/png`. |

## Migration / Rollout

No data migration (proposal Q2 — no real admin-uploaded rows exist). Delivery strategy `stacked-to-main`, 400-line budget.

| PR | Content | Est. changed lines |
|----|---------|-----|
| 1 | `frontend/src/lib/imageUrl.ts` + 5 call sites + vitest suite | ~150 |
| 2 | `env-preflight.js` vars, `render.yaml` keys, RUNBOOKS §4 + list updates, node:test cases | ~130 |
| 3 | Backend cut-over: `r2Client.ts`, `r2StorageEngine.ts`, `upload.ts`, `cleanupUploadedFile.ts`, 3 call-site files, `package.json`, all backend tests | ~470 (≈220 production, ≈250 test) |

Ordering is deliberate and every slice leaves `main` green. PR1 first: the helper is a pure no-op against today's bare-filename rows (the absolute branch never fires yet), so the frontend already understands URLs before any are written — the reverse order would ship a window where new uploads render broken. PR2 second, **inverting** `platform-provisioning`'s "code before preflight" precedent: these vars are operator-provisioning inputs, nothing in the backend reads them yet, so failing preflight closed is exactly the forcing function that guarantees the bucket exists before the cut-over deploys. PR3 last and atomic.

**Review Workload note**: `Decision needed before apply: Yes` · `Chained PRs recommended: Yes` · `400-line budget risk: Medium`. PR1 and PR2 are comfortably inside budget. PR3 is the fork: splitting it into "adapter + tests" then "wiring" would land a module that is dead for one PR, which `AGENTS.md` forbids, and would break the storage cut-over into two non-atomically-revertible halves. Recommendation is a single ~470-line PR3 under an explicit `size:exception`; the alternative split is available if the reviewer prefers budget compliance over atomicity. Decide at apply, not here.

## Rollback

Per-PR `git revert`, but **order matters**: revert PR3 (and PR2 if the operator wants the vars gone) while **keeping PR1**. The helper passes absolute URLs through unchanged, so any row written with an R2 URL during the live window still renders after the backend reverts to disk storage; reverting PR1 too would break exactly those rows. Bucket objects left behind are orphaned but harmless — delete them in the R2 dashboard. No schema change to reverse.

## Open Questions

- [ ] `R2_PUBLIC_URL_BASE` value: `pub-<hash>.r2.dev` (no SLA, rate-limited by Cloudflare) vs. a custom domain. Decision here: the runbook documents both, r2.dev is acceptable pre-launch, and the var makes the swap a value change with no code change. Not blocking.
- [ ] Replacing a product image leaves the previous object in the bucket forever. Pre-existing (disk storage leaked identically) and out of scope — logged as a follow-up, not a regression introduced here.
- [ ] `backend/src/app.js:64` sets `imgSrc: ["'self'"]`. Harmless today (the backend serves no HTML that shows uploads), but any future backend-rendered page displaying a product image would need the R2 host added. Noted, not changed.
