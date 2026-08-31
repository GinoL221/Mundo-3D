```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:767854fd0f6abcc6f4c4419fe3987f5a5839d802156108e36edc758676ff47a1
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 18/18
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:ee0d30b6ad6651a76ba009db2cb236bd4bcb4c5e83cc1fdcd36296c928c706a3
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:a15bc6208b819a596f3c87e2ce96d77c416a734802ee8e3e1dadf0011538d89a
```

## Verification Report

**Change**: object-storage
**Version**: PR1 `a0db735` + PR2 `d3133e4` + PR3 `dfab9c7` (all merged to `main`; verified tree `dfab9c7`)
**Mode**: Strict TDD
**Artifact mode**: hybrid (OpenSpec files authoritative + Engram mirrors)

> **Count semantics**: `requirements 7/7` and `scenarios 18/18` — every spec requirement is
> implemented on `main` and every scenario is satisfied by the shipped system with passing
> evidence: **0 UNTESTED, 0 FAILING, 0 unimplemented**. Seven scenarios carry a caveat marker
> (†  production-gated, ‡ documentation-verified, § static + shared-function coverage). Those
> caveats are graded as WARNINGs below, not as incomplete scenarios: the behaviour the scenario
> describes does hold in the environment the spec targets. WARNING-3 is the spec-text
> reconciliation those caveats require before archive.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 33 (Phase 1: 9, Phase 2: 7, Phase 3: 17) |
| Tasks complete | 33 |
| Tasks incomplete | 0 |
| Tasks checked-but-stale | 2 (3.7, 3.9 — see WARNING-3) |
| Shipped work with no task entry | production-gate follow-up (see WARNING-4) |

### Build & Tests Execution

**Build**: ✅ Passed

```text
$ npx tsc --noEmit          (cwd: backend/)     → exit 0, no diagnostics
$ npx eslint <6 changed prod paths>             → exit 0, no findings
$ node backend/tools/architecture/check.js      → exit 0
```

**Tests**: ✅ 1196 passed / 0 failed (in-scope) · ⚠️ 2 failed out-of-scope

```text
$ pnpm test                                     → exit 0
  backend  : Test Suites 115 passed, 115 total | Tests 947 passed, 947 total
  frontend : Test Files    16 passed,  16 total | Tests 200 passed, 200 total
  sha256:ee0d30b6ad6651a76ba009db2cb236bd4bcb4c5e83cc1fdcd36296c928c706a3

$ pnpm test:deploy-scripts                      → exit 0
  node:test — tests 49, pass 49, fail 0
  sha256:6b8d8775ff0d3cca56bfa4fe427b4b4206b5697c0a9135858a97e7aa42ddab05

$ pnpm --filter backend test:integration        → exit 1  (OUT-OF-SCOPE FAILURE)
  Test Suites: 1 failed, 8 passed, 9 total | Tests: 2 failed, 36 passed, 38 total
  ONLY failing suite: src/__tests__/deploy-migrate-and-start.integration.test.js
  Cause: "Access denied for user 'root'@'localhost'" at ensureFreshDatabase() —
  local MySQL root-password mismatch, NOT caused by this change. Green in CI.
  sha256:0d4488120ca093c5aa9d3ad0cfbb61610b7cc0118efed2587487b5606dc81c46

$ npx jest --config jest.integration.config.js SequelizeUserRepository   → exit 0
  Test Suites: 1 passed | Tests: 1 passed   ← the re-adapted disk-cleanup race test
  sha256:6eb7effecf328ff36974cb8583cb658b867b6b5bb787a47378f0b90fda62d62a
```

**CI on the merged commit `dfab9c7`** — independently confirmed via `gh`, all four jobs green:

| Job | Conclusion |
|-----|-----------|
| Verification gate | ✅ success |
| Quality (lint, types, fast tests, coverage, Astro) | ✅ success |
| Real-DB integration tests | ✅ success |
| End-to-end (Playwright) | ✅ success |

Run history corroborates the reported narrative: `d507d62` ❌ → `5b45256` ❌ (production gate) →
`a341fb8` ✅ (integration-test re-adaptation) → merged `dfab9c7` ✅.

**Coverage**: ➖ Not collected in this run (Quality CI job runs coverage; no per-changed-file
threshold configured in this repo).

### Spec Compliance Matrix

Authoritative source: the 5 spec files under `openspec/changes/object-storage/specs/`.

| Requirement | Scenario | Test (passed at runtime) | Result |
|-------------|----------|--------------------------|--------|
| **object-storage** / Direct Streaming Upload to S3-Compatible Bucket | Valid image streams directly to the bucket | `r2StorageEngine.test.ts > uploads under a dest-namespaced uuid key...` | ✅ COMPLIANT † |
| | Oversized or invalid-type file rejected before upload | `upload.test.ts > keeps fileFilter rejecting...` + `r2StorageEngine.test.ts > does not issue a PutObject when the stream hits the multer size limit` | ✅ COMPLIANT |
| **object-storage** / Full Public URL Persisted for New Uploads | New product image stores an absolute URL | `ProductApiController.test.ts` (`image` = `req.file.location`) + `r2StorageEngine.test.ts > composes location from R2_PUBLIC_URL_BASE + "/" + key` | ✅ COMPLIANT † |
| | New user avatar stores an absolute URL | `UserApiController.test.ts` (register → `image` = `req.file.location`) | ✅ COMPLIANT † |
| **object-storage** / Orphaned Remote Object Cleanup on Failed Write | Failed product update deletes the orphaned object | `ProductApiController.test.ts` (404 → `cleanupUploadedFile(req.file.key)`) + `cleanupUploadedFile.test.ts > issues exactly one DeleteObjectCommand` | ✅ COMPLIANT |
| | Cleanup uses the remote object reference, not a filesystem path | `cleanupUploadedFile.test.ts` (4 cases) + `handleValidationErrors.test.ts` (`req.file.key`) | ✅ COMPLIANT |
| **image-url-resolution** / Dual-Format Image Resolution at Render Time | Absolute bucket URL is used as-is | `imageUrl.test.ts` — https, http, case-insensitive (3 cases) | ✅ COMPLIANT |
| | Bare filename falls back to the legacy relative path | `imageUrl.test.ts` — `/img/products/vase.png`, `/img/users/avatar.jpg` | ✅ COMPLIANT |
| | Rule applied consistently across product and user assets | `header-modules.test.ts:163` covers the `sessionUI.ts` avatar site only; the 4 `.astro` sites verified statically (`rg`), no DOM test | ✅ COMPLIANT § |
| **upload-middleware** (DELTA) / Parameterizable Upload Factory | Factory handles successful upload via fetch | `routes/api/__tests__/products.test.ts` (3 POST-multipart cases through the real multer pipeline) + `upload.test.ts` engine wiring | ✅ COMPLIANT † |
| | Factory handles file format and size validation errors | `upload.test.ts > keeps fileFilter rejecting a disallowed extension/MIME type` + route 400 path | ✅ COMPLIANT |
| **deploy-pipeline-foundations** (DELTA) / Required Production Env Var Preflight | Preflight fails fast when a required var is missing | `scripts/deploy/env-preflight.test.js` (node:test, 49/49) | ✅ COMPLIANT |
| | Preflight passes when all required vars are set | `env-preflight.test.js` | ✅ COMPLIANT |
| | A missing warn-only var warns without failing | `env-preflight.test.js` | ✅ COMPLIANT |
| | Missing `DB_PORT` or `DB_CA_CERT` blocks the deploy | `env-preflight.test.js` | ✅ COMPLIANT |
| | Missing an R2 credential blocks the deploy | `env-preflight.test.js` — 10 parametrised R2 cases incl. real-subprocess non-zero-exit assertions | ✅ COMPLIANT |
| **platform-hosting-topology** (DELTA) / Reproducible Bring-Up Runbook | Operator reproduces the bring-up from the runbook alone | Documentation requirement — no runtime harness exists; `docs/RUNBOOKS.md` §4-§6 verified by inspection | ✅ COMPLIANT ‡ |
| | Operator completes R2 setup from the runbook alone | `docs/RUNBOOKS.md` §4 verified present (12 `R2_` references, §5/§6 renumbered) — no runtime harness | ✅ COMPLIANT ‡ |

**Compliance summary**: 18/18 scenarios COMPLIANT · **0 PARTIAL · 0 UNTESTED · 0 FAILING**

Caveat markers: **†** (4 scenarios) the behaviour holds in production, where the spec text
applies, but the implementation is gated on `NODE_ENV === 'production'` while the spec text reads
unconditionally — reconcile the spec at archive (WARNING-3). **‡** (2 scenarios) documentation
requirement with no possible runtime harness; content verified by inspection. **§** (1 scenario)
the shared rule is unit-tested and one of the five call sites has a DOM test; the other four are
verified statically (SUGGESTION-3).

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Streaming upload, no disk write (production) | ✅ Implemented | `r2StorageEngine.ts:35-88` buffers `file.stream`, one `PutObjectCommand`; never touches `fs` |
| `fileFilter` + 5MB limit preserved | ✅ Implemented | `upload.ts:82-96` — regex and `limits` byte-identical to the disk era; asserted in both env branches |
| `image` = full public URL (production) | ✅ Implemented | `ProductApiController.ts:94,142`, `UserApiController.ts:135` persist `req.file.location`; `r2Client.ts:30-33` composes from `R2_PUBLIC_URL_BASE` |
| Orphan cleanup by key, never `.path` | ✅ Implemented | `cleanupUploadedFile.ts:17`; all 3 call sites pass `.key` (`ProductApiController.ts:157-158`, `UserApiController.ts:172-173`, `handleValidationErrors.ts:18-19`) |
| Dual-format frontend resolution | ✅ Implemented | `imageUrl.ts:14-23`; all 5 call sites wired (verified by `rg`) |
| Preflight requires 5 R2 vars | ✅ Implemented | `scripts/deploy/env-preflight.js:15-19` — list matches spec order exactly |
| `render.yaml` 5 `sync: false` keys | ✅ Implemented | `render.yaml:53-62` |
| RUNBOOKS §4 Cloudflare R2 | ✅ Implemented | `docs/RUNBOOKS.md:136` §4; §5 DNS, §6 first-deploy renumbered as designed |
| No data migration (proposal Q2) | ✅ Confirmed | No migration or seed file touched by any of the 3 commits; `backend/src/database/data/products.json` still holds bare filenames (`figura_mario.jpg`) which `resolveImageUrl` resolves correctly |
| AGENTS.md 250-line cap | ✅ Respected | `r2Client.ts` 38, `r2StorageEngine.ts` 100, `upload.ts` 98, `cleanupUploadedFile.ts` 42, `imageUrl.ts` 23 |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Custom `StorageEngine`, not `multer-s3` | ✅ Yes | Only `@aws-sdk/client-s3` added; no `multer-s3`, no `lib-storage`, no `@types/multer` |
| `image` = `req.file.location`, not `.key` | ✅ Yes | All 3 write sites |
| `cleanupUploadedFile(key)` re-keyed, **not branched** | ⚠️ Deviated | Now **branches** on `NODE_ENV` (`cleanupUploadedFile.ts:22`). Deliberate, user-approved production-gate decision that post-dates the design; both branches unit-tested |
| Disk storage fully removed | ⚠️ Deviated | `createLocalStorageEngine` (`upload.ts:27-66`) reinstates `multer.diskStorage` for dev/test. Same production-gate decision |
| `ContentType` always from validated mimetype | ✅ Yes | `r2StorageEngine.ts:76`; adversarial `evil.png.exe` case asserted |
| No `ACL` ever sent | ✅ Yes | Asserted: `expect(command.input).not.toHaveProperty('ACL')` |
| Lazy R2 client singleton | ✅ Yes | `r2Client.ts:7-21` + `resetR2Client()` test seam |
| uuid-prefixed, dest-namespaced key | ✅ Yes | `^products/<uuid>\.<ext>$` asserted |
| Stacked PRs, each leaving `main` green | ✅ Yes | PR1 179 lines, PR2 148 lines — both under the 400 budget; all 3 merged green |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Two tables present in `apply-progress.md` (PR1 §32-37, PR3 §145-154) |
| All tasks have tests | ✅ | 33/33 — every production task pairs with a RED task |
| RED confirmed (test files exist) | ✅ | 8/8 named test files exist on `main` |
| GREEN confirmed (tests pass) | ✅ | 8/8 pass in this run (947 backend + 200 frontend, exit 0) |
| Triangulation adequate | ✅ | Engine 7 cases, `cleanupUploadedFile` 6 (was 4 — gate split added 2), `upload` 5, `imageUrl` 12, preflight +10 |
| Safety Net for modified files | ✅ | Baselines recorded before each rewrite (old 3/3, 6/6, 29/29, 6/8, 2/3) |
| TDD evidence covers the gate follow-up | ⚠️ | The production-gate follow-up section (`apply-progress.md:179-196`) has **no** RED/GREEN evidence table — see WARNING-4 |

**TDD Compliance**: 6/7 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (Jest, backend) | ~30 in-scope | 6 | jest + ts-jest |
| Unit (vitest, frontend) | 12 | 1 | vitest |
| Unit (node:test, scripts) | 49 | 1 | `node --test` |
| Integration (real DB) | 1 in-scope | 1 | jest + live MySQL |
| Integration (HTTP pipeline) | 28 | 1 | supertest |
| E2E | full auth suite | — | Playwright (CI only) |

Cross-reference: every layer's tooling is present in the repo and executed in this run except
Playwright (CI-only; confirmed green on `dfab9c7`).

### Assertion Quality

Audited all 8 test files created/modified by this change.

**Assertion quality**: ✅ All assertions verify real behavior — 0 CRITICAL, 0 WARNING.

No tautologies, no orphan empty-collection checks, no ghost loops, no assertion-without-
production-call, no smoke-test-only cases. Spot checks:
- `r2StorageEngine.test.ts:112` — `expect(command.input).not.toHaveProperty('ACL')` is a
  negative assertion, but it is paired in the same file with 5 positive assertions on the same
  `command.input`, so the object is proven non-empty and reachable. Non-vacuous.
- `r2StorageEngine.test.ts:146` — `expect(sendMock).not.toHaveBeenCalled()` is paired with
  `expect(err).toBeInstanceOf(Error)`, proving the code path ran. Non-vacuous.
- `imageUrl.test.ts:51,56` — adversarial `//evil/x` and `javascript:alert(1)` assert the exact
  resulting string, not merely "not absolute". Non-vacuous.
- Mock/assertion ratio is healthy everywhere (`r2StorageEngine.test.ts`: 1 module mock vs 17
  assertions).

### Quality Metrics

**Linter**: ✅ No errors (`npx eslint` on all 6 changed production paths, exit 0)
**Type Checker**: ✅ No errors (`npx tsc --noEmit`, exit 0)
**Architecture checker**: ✅ exit 0 (no domain-locality violation)

### Adversarial Checks Requested

| Check | Result |
|---|---|
| `upload.ts` genuinely branches on `NODE_ENV === 'production'` | ✅ `upload.ts:72-75` |
| `cleanupUploadedFile.ts` genuinely branches | ✅ `cleanupUploadedFile.ts:22` |
| **Both** `upload` branches unit-tested | ✅ `upload.test.ts:42` (local) + `:53` (R2) + `:63` (5MB in both) |
| **Both** `cleanup` branches unit-tested | ✅ `describe('in production (R2 bucket)')` + `describe('outside production (local disk)')`, 2 cases each |
| Disk wrapper sets `.key` and `.location` | ✅ set at `upload.ts:55-58` — **but never asserted by any unit test** (WARNING-2) |
| `resolveImageUrl` non-vacuous (absolute + fallback + `//evil/x` + `javascript:`) | ✅ all four asserted, 12 cases |
| `.png.exe` still `ContentType: image/png` | ✅ `r2StorageEngine.test.ts:70-85` |
| No `ACL` sent | ✅ asserted |
| `location` composed from `R2_PUBLIC_URL_BASE` | ✅ asserted |
| Stream `'limit'` → no `PutObject` | ✅ asserted |
| `cleanupUploadedFile` never throws on either branch | ✅ `expect(() => ...).not.toThrow()` asserted in both describes |
| `upload_cleanup_failed` logged on failure | ✅ asserted in both branches |
| No migration of existing `image` rows | ✅ confirmed — no migration/seed file touched |
| Frontend renders bare-filename AND absolute-URL values | ✅ confirmed for both; **a third shape now exists** (WARNING-1) |

### Issues Found

**CRITICAL**: None.

---

**WARNING-1 — The production gate introduced a third `image` value shape that
`resolveImageUrl` double-prefixes (dev/test only).**

Outside production, `createLocalStorageEngine` persists `location` as a **root-relative path**
(`upload.ts:58` → `/img/products/<uuid>.png`), not a bare filename. `resolveImageUrl` only
recognises two shapes — absolute `http(s)://` and bare filename — so the rooted value falls into
the legacy-prefix branch and is doubled. Reproduced directly against the shipped logic:

```text
dev   image='/img/products/9f1c-uuid.png'                   -> '/img/products//img/products/9f1c-uuid.png'   ❌
prod  image='https://pub-test.r2.dev/products/9f1c-uuid.png' -> 'https://pub-test.r2.dev/products/9f1c-uuid.png' ✅
seed  image='vase.png'                                       -> '/img/products/vase.png'                      ✅
```

`apply-progress.md:193` states *"`image` holds a full R2 URL in production, a `/img/...`
relative path in dev; PR1's `resolveImageUrl` already handles both."* — **the second half of
that claim is false** and no test covers it.

Graded WARNING, not CRITICAL, because it is **not a regression from a working state**:
`frontend/public/img/products/` holds only the 24 seed images, while dev uploads land in
`backend/public/img/products/` (760 accumulated uuid files) on a different origin. Locally
uploaded images were already unreachable from the frontend origin before this change — that is
precisely the cross-origin bug `exploration.md` found and that R2 fixes in production. Zero
production impact. Recommend a follow-up: either return a bare filename from the local engine's
`location`, or teach `resolveImageUrl` to pass through values already starting with `/img/`.

---

**WARNING-2 — The storage branch that runs in *every* non-production environment has no direct
unit test of its output contract.**

`upload.test.ts:42-51` mocks `multer.diskStorage` to a marker object and asserts only
`typeof multerOptions.storage._handleFile === 'function'`. `createLocalStorageEngine._handleFile`
is never invoked, so the `key`/`location` composition at `upload.ts:55-58` is verified by source
reading and indirectly by `routes/api/__tests__/products.test.ts` + E2E — never by a direct
assertion. This is exactly where WARNING-1 lives. Codegraph confirms: *"`createLocalStorageEngine`
— ⚠️ no covering tests found."*

---

**WARNING-3 — Four spec scenarios and two task descriptions read unconditionally but shipped
production-gated. Spec text needs a correction before archive.**

The gate post-dates the specs, so the following spec text no longer describes what ships in
non-production environments:

| Spec | Text that is now production-only |
|---|---|
| `object-storage` REQ 1 scenario 1 | "the file MUST be uploaded to the bucket without ever being written to local disk" |
| `object-storage` REQ 2 (both scenarios) | "Every new ... upload MUST persist a full, absolute, provider-hosted URL" |
| `object-storage` REQ 3 scenario 1 | "the object just uploaded MUST be deleted from the bucket" |
| `upload-middleware` DELTA | "The factory's destination MUST be an S3-compatible remote bucket, not a local disk path" |

Stale task text: `tasks.md:59` (3.9) says "drop `fs`/`path.join` destination code" — `upload.ts`
still imports `fs` and calls `path.join`/`mkdirSync` inside the local engine; `tasks.md:57` (3.7)
describes an unconditional `DeleteObjectCommand`.

This is the same reconciliation `platform-provisioning` performed for `deploy:start`. Recommend
`sdd-archive` add a **Change (2026-08-30, object-storage gate)** annotation scoping these to
`NODE_ENV === 'production'` and recording the dev/test disk fallback, rather than archiving text
that contradicts the code.

---

**WARNING-4 — The production-gate follow-up shipped with no task entries and no TDD evidence
table.**

`apply-progress.md:179-196` documents the gate as a narrative section. It changed 2 production
files and rewrote 2 test files, plus a later re-adaptation of
`SequelizeUserRepository.integration.test.ts` (commit `a341fb8`) that the section does not
mention at all. `tasks.md` was never extended with 3.18+ entries, so "33/33 complete" understates
the work actually delivered, and Strict TDD's RED→GREEN evidence for the gate is absent. The
resulting tests are good (both branches covered) — the gap is in the record, not the code.

---

**WARNING-5 — PR3's authored size is ~987 lines, not the ~723 recorded.**

Measured on `dfab9c7` excluding the generated `pnpm-lock.yaml`: **810 insertions + 177 deletions
= 987 authored lines** — 2.5× the 400-line budget, and ~264 more than `apply-progress.md:102`
records (the gate follow-up landed after that number was written). `size:exception` was accepted
by the maintainer this session, so this is **not a blocker**; the archive record should carry the
true figure. PR1 (179) and PR2 (148) are both comfortably within budget.

---

**WARNING-6 — `apply-progress.md:55` still shows Phase 3 unchecked.**

`- [ ] Phase 3 (PR3): backend R2 storage cut-over` in PR1's "Remaining Tasks" list contradicts the
Phase 3 section's own "17/17 PR3 tasks complete". Bookkeeping only.

---

**SUGGESTION-1** — `routes/api/__tests__/products.test.ts` still stubs `S3Client` and sets the 5
`R2_*` env vars, but under `NODE_ENV=test` the local disk engine runs, so the stub is now dead
weight. It also means those 3 POST-multipart cases write real files into
`backend/public/img/products/` (gitignored, but 760 files have accumulated there).

**SUGGESTION-2** — `publicUrlFor` has no direct unit test. Its trailing-slash-stripping branch
(`r2Client.ts:31`) is never exercised: the engine test sets `R2_PUBLIC_URL_BASE` without a
trailing slash. A one-line case would close it.

**SUGGESTION-3** — Four of the five `resolveImageUrl` call sites (`ProductSearch.astro`,
`product.astro`, `index.astro`, `CartList.astro`) have no DOM-level test; only `sessionUI.ts` is
covered (`header-modules.test.ts:163`). Pre-existing gap, correctly disclosed in
`apply-progress.md:37`.

### Accepted Gaps — Confirmed Documented, Not Silently Skipped

| Gap | Where disclosed | Confirmed |
|---|---|---|
| Real R2 SigV4 / bucket public-access / public-host serving untested in CI | `design.md` Testing, `tasks.md:67` (3.17), `apply-progress.md:121` | ✅ |
| Every S3 call mocked; no MinIO/localstack | `design.md` (explicitly rejected), `apply-progress.md:121` | ✅ |
| R2 engine exercised **only** in production — so it now runs in no automated environment at all, including E2E | `apply-progress.md:179-196` | ✅ (narrower than originally documented) |
| Replacing a product image orphans the previous object | `design.md` Open Questions, `apply-progress.md:172` | ✅ pre-existing, disk leaked identically |
| `app.js:64` `imgSrc: ["'self'"]` would need the R2 host for backend-rendered uploads | `design.md` Open Questions | ✅ not currently reachable |
| `size:exception` for PR3 | maintainer-accepted this session; `tasks.md:14`, `design.md` | ✅ not a blocker |

### Verdict

**PASS WITH WARNINGS**

All 33 tasks are complete and match the code on `main`; all 7 spec requirements are implemented;
`pnpm test` (1147 tests), `pnpm test:deploy-scripts` (49), `tsc --noEmit`, `eslint`, and the
architecture checker are all green, the re-adapted real-DB test passes against a live MySQL, and
all four CI jobs — including E2E and Real-DB integration — are green on the merged commit. The
only integration failure is the documented, unrelated local MySQL root-password mismatch. Six
warnings remain, none blocking: one genuine dev-only rendering defect introduced by the
production gate (WARNING-1/2), and a set of record-accuracy items (WARNING-3/4/5/6) that
`sdd-archive` should reconcile — most importantly the spec text, which currently reads
unconditionally where the implementation is production-gated.
