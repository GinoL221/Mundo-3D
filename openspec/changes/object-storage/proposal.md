# Proposal: Object storage for admin-uploaded images

Traceability: exploration `openspec/changes/object-storage/exploration.md` (Engram #6921).

## Intent

Admin-uploaded product images and user avatars are broken in two independent ways:

1. **Not durable** — Render's free tier has no persistent disk, so multer writes under
   `backend/public/img/...` vanish on redeploy, restart, or 15-min spin-down.
2. **Not reachable (live today)** — 5 frontend call sites build root-relative
   `/img/products/${image}` URLs that resolve against Vercel's origin, never Render's. Every
   admin-uploaded image already 404s in production, regardless of disk persistence.

Storing a full public bucket URL in the `image` column fixes both at once, which is why they
are one change rather than a hotfix plus a separate migration.

## Scope

### In Scope

- Cloudflare R2 storage engine replacing `multer.diskStorage` in
  `backend/src/infrastructure/middlewares/upload.ts` (`fileFilter`/`limits` preserved verbatim).
- `ProductApiController.ts` (`create`/`update`) and the `users.ts` registration handler adapted
  to the new `req.file` shape.
- `cleanupUploadedFile.ts` gains a remote delete-object path (today it silently no-ops on a
  non-disk `req.file` — a real regression if left behind).
- `image` stores a full public URL for **new** writes.
- Frontend resolution rule at all 5 `<img>` sites: absolute URL used as-is, bare filename falls
  back to the existing `/img/{products,users}/` prefix so seed rows keep working.
- `scripts/deploy/env-preflight.js`: R2 vars required in production.
- `docs/RUNBOOKS.md` "Platform bring-up": R2 subsection matching the Aiven/Render/Vercel style.

### Out of Scope

- Image transformation/resizing/CDN features (why Cloudinary was rejected).
- Migrating seed images into the bucket — they are committed static assets and work fine.
- Changing allowed types or the 5MB limit.
- Upload UI/UX changes.
- Provisioning the Cloudflare account/bucket — operator work, documented not automated.

## Capabilities

### New Capabilities

- `object-storage`: uploads persisted to an S3-compatible bucket, `image` holds a full public
  URL, orphaned remote objects cleaned up on failed writes.
- `image-url-resolution`: absolute-vs-legacy-filename rendering rule shared by all `<img>` sites.

### Modified Capabilities

- `upload-middleware`: destination is a remote bucket, not `public/img/<dest>`; validation
  requirements unchanged.
- `deploy-pipeline-foundations`: R2 credentials join the required production preflight set.
- `platform-hosting-topology`: bring-up runbook must cover R2 setup.

## Approach

Cloudflare R2 over the S3-compatible API (`@aws-sdk/client-s3`). Zero egress at any volume,
10 GB free storage, and no bespoke SDK lock-in — switching to Backblaze B2 later would change
only endpoint and credentials. Backblaze B2 is the fallback; Cloudinary is rejected because its
differentiator is an explicit non-goal.

Recommended migration shape: **(1) direct streaming multer-s3 engine** — idiomatic, no redundant
local write — accepting that it touches `ProductApiController.ts` and `cleanupUploadedFile.ts`.
Alternative **(2) local temp write + explicit upload** preserves `.filename`/`.path` and lowers
controller churn. See Q1.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/infrastructure/middlewares/upload.ts` | Modified | Disk engine → R2 engine |
| `backend/src/infrastructure/controllers/ProductApiController.ts` | Modified | New `req.file` shape |
| `backend/src/infrastructure/routes/api/users.ts` | Modified | Registration handler |
| `backend/src/infrastructure/utils/cleanupUploadedFile.ts` | Modified | Remote delete |
| 5 frontend `<img>` sites | Modified | Absolute-URL resolution rule |
| `scripts/deploy/env-preflight.js` | Modified | New required vars |
| `docs/RUNBOOKS.md` | Modified | R2 bring-up subsection |
| `backend/package.json` | Modified | New S3 SDK dependency |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `cleanupUploadedFile` left disk-only → silent remote-object leak | Med | In scope, not deferred (Q3) |
| Legacy bare-filename rows break under the new rule | Med | Dual-format resolution rule is mandatory, not optional |
| Free-tier limits exceeded (10 GB / 1M+10M ops) | Low | Documented as a scaling trigger in the runbook |
| Manual R2 provisioning drifts from preflight expectations | Med | Fail-closed preflight + runbook, same pattern as `DB_PORT`/`DB_CA_CERT` |
| Public bucket exposes uploads to unauthenticated reads | Low | Intended — these are public catalog images; no private data stored |

## Rollback Plan

Revert the change commits. Pre-existing behavior returns: uploads write to local disk and
seed images still render via the relative path. Bucket objects written meanwhile are orphaned
but harmless; delete them in the R2 dashboard. No schema change to reverse — `image` stays a
`STRING`; any rows holding full URLs would need manual correction, so roll back before an
admin uploads in production if possible.

## Dependencies

- A Cloudflare account with R2 enabled, one public bucket, and an S3 API token (operator step).
- New backend dependency: `@aws-sdk/client-s3` (+ `multer-s3` if shape (1) is chosen).

## Success Criteria

- [ ] An admin-uploaded product image survives a Render redeploy and still renders.
- [ ] An admin-uploaded image and a user avatar render on the deployed Vercel frontend.
- [ ] Seed catalog images still render unchanged.
- [ ] A failed create/update leaves no orphaned object in the bucket.
- [ ] `env-preflight` fails closed in production when any R2 var is missing.
- [ ] An operator can complete R2 setup from `docs/RUNBOOKS.md` alone.

## Proposal question round — RESOLVED (user confirmed 2026-08-30)

1. **Migration shape.** RESOLVED → direct streaming `multer-s3` engine (recommended default).
   Idiomatic, no redundant local write; touches `ProductApiController.ts` and
   `cleanupUploadedFile.ts` as an accepted consequence.
2. **Existing rows.** RESOLVED → no real admin-uploaded rows exist (project is pre-launch).
   No data migration needed; new writes store full URLs, the legacy relative-path fallback
   covers seed rows.
3. **`cleanupUploadedFile` remote delete.** RESOLVED → fixed in THIS change, not deferred.
   Leaving it disk-only would silently no-op on the new storage engine, orphaning remote
   objects on any failed write with no visible error.
