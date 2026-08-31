# Exploration: object-storage

Brand-new change. `platform-provisioning` (archived 2026-08-30) explicitly deferred object
storage for admin-uploaded images: Render's free web-service tier has no persistent disk, so
anything multer writes to `backend/public/img/...` is lost on redeploy, restart, or a 15-minute
idle spin-down.

Engram mirror: `sdd/object-storage/explore` (observation #6921).

## Current State

### Upload pipeline (backend)

- `backend/src/infrastructure/middlewares/upload.ts:20-62` — `createUpload(dest: string)`
  factory. `multer.diskStorage`: `destination` = `path.join(process.cwd(), 'public', 'img', dest)`
  (mkdir if missing, `:27-30`); `filename` = `${uuidv4()}${path.extname(originalname)}`
  (`:38`, bare filename, NO path prefix). `fileFilter` (`:42-56`) allows only
  jpeg/jpg/png/gif/webp by BOTH extname and mimetype regex. `limits.fileSize = 5MB` (`:60`).
- Two callers, same factory, different `dest`:
  - `backend/src/infrastructure/routes/api/products.ts:50` — `createUpload('products')` →
    `uploadImgProduct.single('image')` on `POST /api/products` (create) and `PUT /api/products/:id`
    (update).
  - `backend/src/infrastructure/routes/api/users.ts:33,152` — `createUpload('users')` →
    `uploadImgUser.single('image')`, required field on registration.
- `backend/src/infrastructure/controllers/ProductApiController.ts:73-110,112-167` —
  `create`/`update` read `req.file?.filename` (bare uuid+ext, NOT a path) and pass it straight
  through as `image` to the use case → persisted as-is. `update` (`:157-159`) calls
  `cleanupUploadedFile(req.file.path)` on a 404 target, to avoid orphaning a disk write —
  `backend/src/infrastructure/utils/cleanupUploadedFile.ts:9-26` does `fs.unlink(filePath)`,
  hard-assuming multer's disk-storage `.path` property. An S3-style engine (`multer-s3`) exposes
  `.key`/`.location` instead of `.path`, so this cleanup would silently no-op (early return on
  falsy `filePath`, no error) if swapped naively.
- `backend/src/database/models/Product.js:37-40` and `User.js:29-32` — `image` is a plain
  `DataTypes.STRING`, no format constraint. Confirmed via `ListProductsUseCase.ts:47` /
  `SearchProductsUseCase.ts:36` that the API returns exactly this bare string, no prefix, no host.

### Rendering (frontend) — confirmed cross-origin bug, broader than initially scoped

Root-relative `<img src="/img/products/${...}">` / `/img/users/${...}` construction is NOT
confined to one component — verified directly in **five** places:

| File | Line |
|---|---|
| `frontend/src/domains/products/components/ProductSearch.astro` | `:154` |
| `frontend/src/pages/product.astro` | `:115` |
| `frontend/src/pages/index.astro` | `:188` |
| `frontend/src/domains/cart/components/CartList.astro` | `:118` |
| `frontend/src/scripts/sessionUI.ts` | `:66` (user avatars, not just products) |

- `frontend/src/domains/products/adapters/product.adapter.ts:75` —
  `image: apiProduct.image || ''`, passed through unchanged; no host prefixing anywhere.
- `frontend/src/config.ts` — `API_URL` (from `PUBLIC_API_URL`) is used for `fetch()` JSON calls
  only; it is NEVER applied to any `<img src>` path.

**The bug**: `docs/RUNBOOKS.md:95-107` (Platform bring-up) confirms the deployed topology —
frontend on Vercel at `<domain>`, backend on Render at `api.<domain>` — same registrable domain
(for the auth cookie) but **different origins** for browser resource loading. A root-relative
`<img src="/img/products/X.png">` on a page served from `https://<domain>` resolves against
Vercel's own static file server, not Render's `express.static` (`backend/src/app.js:109`).

This "works" today ONLY for the seed images physically committed to git under
`frontend/public/img/products/` — Vercel serves those as static build output at that exact path.
It does NOT and CANNOT work for anything multer actually writes, because multer only ever writes
to `backend/public/img/{products,users}/`, which is gitignored (`.gitignore:146-153`) and lives
only on Render's filesystem, never in the Vercel build.

**Conclusion: any admin-created/edited product image, and any user profile picture, already 404s
today on the deployed Vercel frontend — regardless of whether Render's disk is ephemeral or
persistent.** This is a distinct, pre-existing correctness bug (relative-URL-assumes-same-origin),
stacked on top of (not caused by) the storage-durability problem. Storing a full public bucket URL
in `image` would fix BOTH issues at once, as a side effect of the URL becoming absolute.

### Env/preflight and docs

- `scripts/deploy/env-preflight.js:9-10` currently hard-requires `DB_PORT`, `DB_CA_CERT` only.
  No storage-related vars exist yet.
- `docs/RUNBOOKS.md` "Platform bring-up" section has no storage-provider subsection yet.
- No AWS/S3/Cloudinary/Backblaze SDK dependency currently exists in `backend/package.json` —
  this is a brand-new integration, not a swap of an existing one.

## Affected Areas

- `backend/src/infrastructure/middlewares/upload.ts` — storage engine (disk vs. remote-object
  adapter); `fileFilter`/`limits` must be preserved regardless of approach.
- `backend/src/infrastructure/controllers/ProductApiController.ts` (`create`, `update`) and
  `backend/src/infrastructure/routes/api/users.ts` registration handler — `req.file` shape
  differs (`.filename`/`.path` vs `.key`/`.location`).
- `backend/src/infrastructure/utils/cleanupUploadedFile.ts` — needs a remote-delete equivalent.
- `backend/src/database/models/Product.js`, `User.js` — `image` semantics change (bare filename
  → full public URL) if that approach is taken.
- All 5 frontend `<img src>` call sites listed above — must stop assuming same-origin once
  `image` becomes a portable URL. (A full grep for any other site should be redone in design —
  this list came from direct verification, not treated as exhaustive.)
- `scripts/deploy/env-preflight.js` — new required vars for storage credentials.
- `docs/RUNBOOKS.md` "Platform bring-up" — new subsection for the chosen provider.

## Approaches (storage provider) — verified current (2026) free-tier terms, not training-data pricing

1. **Cloudflare R2 (S3-compatible)** — 10 GB-month storage, 1M Class A / 10M Class B ops/month
   free, **zero egress fees at any volume**. S3-compatible (`@aws-sdk/client-s3`/`multer-s3`, no
   bespoke SDK). Requires a new Cloudflare account + public-bucket/custom-domain setup for
   serving. Effort: Low–Medium.
2. **Backblaze B2 (S3-compatible)** — 10 GB free storage; egress free up to 3x monthly average
   storage, then $0.01/GB, or free unlimited via Bandwidth Alliance (Cloudflare/Fastly/Vultr)
   fronting. Cheapest paid tier if outgrown. Conditional free egress is an extra moving part.
   Effort: Low–Medium.
3. **Cloudinary (image-specific)** — 25 credits/month shared pool (storage+bandwidth+
   transformations). NOT S3-compatible — bespoke SDK, would be the only non-portable option.
   Transformation features are an explicit non-goal here. Effort: Low, but inconsistent long-term.
4. **Supabase Storage** — rejected: only 1 GB free storage, 5 GB free egress, and free projects
   pause after 7 days of inactivity — actively hostile to a durability-focused change. No
   Postgres synergy (this project uses Aiven MySQL).
5. **AWS S3** — rejected: free tier is 5GB/**12-months-only**, not indefinite; $0.09/GB egress
   after that with no exemption. Worse than R2/B2 on both axes, and buys no portability advantage
   since R2/B2 are already S3-API-compatible.

## Migration Shape (independent of provider choice)

Two realistic implementation shapes for `upload.ts`:

- **(a) Direct streaming multer storage engine** (`multer-s3` at R2's S3-compatible endpoint) —
  replaces `multer.diskStorage`. `fileFilter`/`limits` transfer unchanged (multer-level options).
  `req.file` shape changes (`.key`/`.location`), requiring updates to `ProductApiController.ts`
  and `cleanupUploadedFile.ts` (needs a remote delete-object call).
- **(b) Local temp write + explicit upload step** — keep `multer.diskStorage` writing to a tmp
  path, then an explicit post-multer step uploads to the bucket and deletes the temp file.
  Preserves `req.file.filename`/`.path` shape (less controller churn), at the cost of an extra
  step and a transient (not persisted) local write.

Direction (not a decision — belongs in propose/design): (a) is more idiomatic long-term and
avoids a redundant write; (b) is lower-blast-radius if minimizing controller changes matters more.

## DB Migration Question

If `image` becomes a full public bucket URL instead of a bare filename, this simultaneously fixes
the cross-origin `<img>` bug as a side effect (the URL becomes absolute and provider-hosted).
Seed data's `image` values (e.g. `busto_iron_man.jpg`) point at git-committed
`frontend/public/img/products/` assets and are explicitly OUT of scope — only admin-uploaded rows
are at risk. Whether any real (non-seed) admin-uploaded rows currently exist in a live/staging DB
was NOT inspected in this exploration; that affects whether a value-format migration
(bare filename → full URL, or a legacy-fallback resolution rule) is actually needed. Decide in
propose.

## Recommendation

**Cloudflare R2.** Free egress at any volume removes the most unpredictable cost variable for
image serving; free-tier storage/ops ceiling comfortably covers a small hobby-scale catalog;
S3-compatible API means standard tooling applies with no bespoke SDK lock-in, and moving to B2
later would only change endpoint/credentials. Backblaze B2 is a credible fallback with the same
portability property. Cloudinary is not recommended — its differentiator (transformations) is an
explicit non-goal, and its non-S3-compatible API would be a one-off integration pattern.

## Risks

- **The cross-origin `<img>` bug is likely already live in production**, independent of this
  change's durability motivation — admin-uploaded images and user avatars are broken TODAY on the
  deployed Vercel+Render split, not just "will be lost on next redeploy." Worth surfacing as a
  possible hotfix candidate separate from, or as an early milestone within, this change.
- Vendor account setup (Cloudflare R2 dashboard, API token/access-key generation) is a manual step
  outside version control — needs its own preflight vars and runbook subsection, following the
  exact pattern `platform-provisioning` established for `DB_PORT`/`DB_CA_CERT`.
- `cleanupUploadedFile.ts`'s hard dependency on `fs.unlink`/`.path` is an easy-to-miss regression
  point if approach (a) is chosen without updating it — silent leak or silent no-op, no error.
- No real production DB was inspected to confirm whether live admin-uploaded rows exist yet.
- Free-tier limits (R2: 10GB/1M+10M ops; B2: 10GB) are generous but not unlimited — note as a
  scaling trigger in the runbook, not assumed permanent.

## Ready for Proposal

Yes. The cross-origin bug finding should be explicitly surfaced to the user before/during propose
since it may change scope (frame this change as fixing two bugs, not one) or urgency (a narrow
same-origin-prefix hotfix decoupled from the full storage migration timeline is also possible).
