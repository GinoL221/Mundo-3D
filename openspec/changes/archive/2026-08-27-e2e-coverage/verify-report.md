```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:f1b9a7d347fb21fbfd420b5ff3410804ed6f899da7fe929bdb936a42a54bda82
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 3/3
scenarios: 14/14
test_command: pnpm --filter e2e test --project=chromium
test_exit_code: 0
test_output_hash: sha256:240d96405c75a4f34fd43c3df85290af4a8665fb41929a580cdc148e98e8cc98
build_command: pnpm --filter backend lint && pnpm --filter backend type-check && pnpm --filter backend architecture:check
build_exit_code: 0
build_output_hash: sha256:46324557020bc5a2fc80d71f8bc0c18635811dc8d9882f15adb09908c58990e2
```

## Verification Report

**Change**: e2e-coverage
**Version**: delta `openspec/changes/e2e-coverage/specs/e2e/spec.md` → merged into `openspec/specs/e2e/spec.md`
**Mode**: Strict TDD (module loaded; see TDD Compliance for the test-only adaptation)
**Verified at**: main @ `258fcaa`

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 22 |
| Tasks incomplete | 0 |

All 22 checkboxes in `openspec/changes/e2e-coverage/tasks.md` are `[x]` and each maps to code present on `main`.

### Build & Tests Execution

**Build**: ✅ Passed

```text
pnpm --filter backend lint            → exit 0 (eslint src/, no output)
pnpm --filter backend type-check      → exit 0 (tsc --noEmit, no output)
pnpm --filter backend architecture:check → exit 0 (tools/architecture/check.js, no violations)
```

**Tests**: ✅ 38 passed / 0 failed / 0 skipped

```text
pnpm --filter e2e test --project=chromium   (after rm -rf e2e/.auth)
Run 1 (cold .auth): 38 passed (44.8s) — exit 0
Run 2:              38 passed (44.6s) — exit 0
Run 3:              38 passed (43.3s) — exit 0
```

Run 1 was executed from a deleted `e2e/.auth/` directory, which is the exact condition that produced the original ENOENT false-positive. Three consecutive green runs satisfy the proposal's "green across 3 consecutive runs (no flakes)" success criterion.

**Coverage**: ➖ Not available — Playwright E2E has no coverage instrumentation configured in this repo.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| E2E Authentication Verification | Successful User Registration | `auth.spec.ts:11` | ✅ COMPLIANT |
| E2E Authentication Verification | Successful User Login | `auth.spec.ts:32` | ✅ COMPLIANT |
| E2E Authentication Verification | Invalid Credentials Handling | `auth.spec.ts:45` | ✅ COMPLIANT |
| E2E Authentication Verification | User Logout | `auth.spec.ts:144` | ✅ COMPLIANT |
| E2E Authentication Verification | Duplicate Email Registration Rejected | `auth.spec.ts:161` | ✅ COMPLIANT |
| E2E Authentication Verification | Missing Image Registration Rejected | `auth.spec.ts:184` | ✅ COMPLIANT |
| E2E Admin Product Management | Role-Based Visibility | `admin-products.spec.ts:174,184,194,201` (4 tests) | ✅ COMPLIANT |
| E2E Admin Product Management | Delete Restricted to Admin | `admin-products.spec.ts:215` | ✅ COMPLIANT |
| E2E Admin Product Management | Full Product CRUD Lifecycle | `admin-products.spec.ts:234,259,276,289` (4 tests) | ✅ COMPLIANT |
| E2E Admin Product Management | Stock Adjust Client-Side Double-Click Guard | `admin-products.spec.ts:315` | ✅ COMPLIANT |
| E2E Admin Product Management | 401 Mid-Session Redirects Silently | `admin-products.spec.ts:356` | ✅ COMPLIANT |
| E2E Product Listing/Detail States | Listing Renders Error State on API Failure | `product-states.spec.ts:8` | ✅ COMPLIANT |
| E2E Product Listing/Detail States | Listing Renders Empty State on Zero Products | `product-states.spec.ts:20` | ✅ COMPLIANT |
| E2E Product Listing/Detail States | Detail Page Renders Error State for Invalid Product | `product-states.spec.ts:42,52` (2 tests) | ✅ COMPLIANT |

**Compliance summary**: 14/14 scenarios compliant across 3 requirements (1 MODIFIED, 2 ADDED). 21 tests cover 14 scenarios; 4 scenarios are triangulated with 2–4 cases each.

Two compliance notes verified against production source rather than accepted from the test text:

- **401 Mid-Session** — the scenario's "MUST clear the session" clause is proven transitively, not weakly: `handleUnauthorized()` (`frontend/src/pages/admin/products/index.astro:110-115`) runs `void clearSession()` and `window.location.href = '/login'` as an unconditional two-statement sequence, so asserting arrival at `/login` from the 401 branch necessarily proves `clearSession()` was invoked. The "no form state persists" clause is non-applicable to the stock-adjust path (no form involved).
- **Detail error scenario** — the merged capability spec says "MUST render the error state and MUST NOT render the standard product content". The implementation asserts `#product-error` visible **and** `#product-content` hidden, which matches that wording exactly. See Design Coherence for the task-9.1 adaptation.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Zero production code modified | ✅ Verified | `git diff --name-only c31c853..258fcaa` returns 9 files: 3 e2e specs, `test-prepare.js`, 5 openspec docs. Nothing under `backend/src/{application,domain}`, `backend/src/infrastructure/{controllers,routes}`, or `frontend/src`. |
| Delta merged into capability spec | ✅ Verified | Both ADDED requirements present in `openspec/specs/e2e/spec.md`; the 2 new auth scenarios folded into the existing "E2E Authentication Verification" block; requirement prose updated to mention rejection paths. |
| STAFF fixture seeded | ✅ Verified | `test-prepare.js` inserts `staff@email.com` / `idRole: 3` guarded by `findOne`; observed live in run 1 output ("STAFF fixture user seeded"). Drift pointer comment names both `Role.ts` and `auth.adapter.ts` mirrors. |
| Seeded rows never mutated | ✅ Verified | `sweepFixtureProducts()` deletes only `nameProduct.startsWith('E2E-')`; `fixtureName()` always emits that prefix. No seeded product name can match. |
| Backend gates clean | ✅ Verified | lint, type-check, architecture:check all exit 0. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Role sessions via per-file `storageState` generated in `beforeAll` | ✅ Yes | Three `request.newContext()` logins writing `.auth/{admin,staff,regular-user}.json`; describes use `test.use({ storageState })`. |
| Fixture products created/swept by an ADMIN `APIRequestContext` | ✅ Yes | Module-scoped `adminApi`, raw `m3d_csrf` value as `X-CSRF-Token`, `afterEach` sweep, 404 tolerated. |
| Double-click guard via held route + `dblclick()` | ✅ Yes | `patchCount` counter, deferred `held` promise, `dblclick()`, `expect.poll(patchCount).toBe(1)`, post-release `toHaveText('6')`. No `waitForTimeout`, no `dispatchEvent`. |
| Error/empty states faked at the network edge | ✅ Yes | `page.route().fulfill()` for 500 and `{"products":[]}`; real `id=999999` for the detail 404 plus one intercepted 500. |
| STAFF fixture hardcodes `idRole: 3` in `test-prepare.js` | ✅ Yes | Matches the Luigi-product block shape; `bcryptjs` required at top as `seed.js` does. |
| Detail-error selector `#product-title` | ⚠️ Adapted | Implementation asserts `#product-content` instead. Correct — `#product-title` always renders and only swaps text via `showError()`; `#product-content` is the element that toggles. Recorded in tasks.md 9.1, but `design.md`'s selector table still names `#product-title`. |
| `adminApi` context construction | ⚠️ Adapted | Implementation adds `mkdirSync('.auth')` and `storageState: undefined`; `design.md`'s code snippet still shows the pre-fix form. |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ⚠️ N/A by scope | No "TDD Cycle Evidence" table in apply-progress. Justified, not a protocol breach: this is a coverage change over already-shipped behavior with a hard "no production code change" scope, so a production RED→GREEN cycle is structurally impossible — a new E2E test here must pass on first run against correct code. `tasks.md` pre-declared this ("no RED→GREEN production cycle"). Should have been recorded as an explicit N/A rather than omitted. |
| All tasks have tests | ✅ | 22/22 tasks map to shipped test code or a spec-merge artifact. |
| RED confirmed (tests exist) | ✅ | 3/3 test files exist on `main` and were executed. |
| GREEN confirmed (tests pass) | ✅ | 38/38 pass on execution, 3 consecutive runs. |
| Triangulation adequate | ✅ | Role visibility 4 cases (admin/staff/user/guest); CRUD 4 cases (create/edit/delete-accept/delete-dismiss); detail error 2 cases (real 404 / intercepted 500); listing states assert two *different* h2 strings (`No se pudo cargar` vs `Próximamente`), not two empty checks. |
| Safety Net for modified files | ✅ | `auth.spec.ts` and `test-prepare.js` were modified, not created; all 7 pre-existing `auth.spec.ts` cases and every other spec file still pass. |

One genuine RED→GREEN cycle did occur, on test infrastructure: the ENOENT failure was observed red in CI on PR #66, fixed by `10d6dd6`, and is green here from a cold `.auth/`.

**TDD Compliance**: 5/6 checks passed, 1 scoped N/A.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 0 | 0 | vitest (not exercised by this change) |
| Integration | 0 | 0 | vitest (not exercised by this change) |
| E2E | 38 (21 new/changed) | 7 (3 touched) | @playwright/test 1.49 |
| **Total** | **38** | **7** | |

Layer choice is correct for the intent: every scenario asserts cross-boundary behavior (client role gate vs server guard, real CSRF, real MySQL) that no unit test can prove.

### Changed File Coverage

Coverage analysis skipped — no coverage tool is configured for the Playwright suite. Not a failure.

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| — | — | — | — | — |

**Assertion quality**: ✅ All assertions verify real behavior. Audited both new files plus the `auth.spec.ts` additions:

- No tautologies. `expect(deleteRequested).toBe(false)` (L308) and `expect(dialogShown).toBe(false)` (L380) read flags mutated by real route/dialog interception, and each has a positive companion path in the same describe, so neither is a vacuous negative.
- No orphan empty-collection checks. `toHaveCount(0)` appears twice and both are paired with a positive assertion in the same or adjacent test (`.admin-product-delete` count 0 for STAFF vs `toBeVisible()` for ADMIN; row count 0 after delete-accept vs `toBeVisible()` after delete-dismiss).
- No type-only assertions used alone; no smoke-test-only cases — every test asserts *what* rendered, not merely that a page rendered.
- No ghost loops. The only loop (`sweepFixtureProducts`) is cleanup, and contains no assertions.
- No mock-heavy tests: 0 `vi.mock()`, 41 assertions across the 2 new files. Interception is used for network-edge control, not for stubbing units.
- Assertions on Spanish copy (`Este email ya está registrado`, `Tienes que subir una imagen`, `No se pudo cargar`, `Próximamente`) are contract strings the proposal explicitly authorized, and the two listing strings are the only differentiator between the two shared-`.empty-state` branches.

### Quality Metrics

**Linter**: ✅ No errors (`eslint src/`, exit 0)
**Type Checker**: ✅ No errors (`tsc --noEmit`, exit 0)
**Architecture**: ✅ No boundary violations (exit 0)
**File-size policy**: ✅ `admin-products.spec.ts` is 382 lines, over the 250-line cap, but `AGENTS.md` explicitly exempts `*.spec.ts`; the file has one concern (admin product management) and does not mix unrelated areas.

### Known Accepted Findings (confirmed, not re-raised)

| # | Finding | Confirmation |
|---|---------|--------------|
| 1 | Playwright ENOENT `.auth/admin.json` setup bug fixed in `10d6dd6` | ✅ Present and correct on `main`. `mkdirSync('.auth', { recursive: true })` at `admin-products.spec.ts:132`, plus `storageState: undefined` on all three setup contexts (L134, L138, L142). Both halves are necessary: the directory is not auto-created by `APIRequestContext.storageState({path})`, and `request.newContext()` otherwise inherits a describe-scoped `test.use({storageState})` and tries to *read* the file first. **Proven at runtime**, not just by reading: run 1 executed after `rm -rf e2e/.auth`, and `admin-products.spec.ts` is alphabetically first, so its `beforeAll` ran with no `.auth/` on disk and passed. The 15-line comment above the fix explains both quirks accurately. |
| 2 | Pre-existing empty-`material` production bug left unfixed | ✅ Bug independently re-verified from source, not accepted from the comment: `productValidators.ts:34` uses `.optional({ values: 'falsy' })`, so `''` **skips validation entirely**; `CreateProductUseCase.ts:35` `input.material ?? null` does not coerce `''` to `null`; `Product.ts:30` then guards only `!== null && !== undefined`, so `''` reaches `ALLOWED_MATERIALS.includes('')` (false) and `''.startsWith('Otros: ')` (false) → throws `Invalid material`. Real, and reachable today by any admin submitting the form with material blank. Correctly left unfixed for a test-only change. The workaround (`page.fill('#material', 'PLA')` at L249 and L269) is **not** misleading: each site carries a comment naming the exact mechanism and labelling it pre-existing and unrelated. It does not mask the bug in the tested path either — no scenario in this change claims to cover blank-material submission, so nothing is silently green that should be red. See WARNING 1 for the tracking gap. |
| 3 | Task 9.1 adapted from `#product-title` to `#product-content` | ✅ Adaptation is real and leaves nothing unverified. `#product-title` always renders and only swaps text via `showError()`; `#product-content` is the element that actually toggles. The merged capability spec's scenario was written as "MUST render the error state and MUST NOT render the standard product content", which `#product-content` `toBeHidden()` satisfies exactly. Both halves of the scenario are asserted, in two triangulated tests (real 404 and intercepted 500). The adaptation is recorded inline in tasks.md 9.1. |

### Issues Found

**CRITICAL**: None.

**WARNING**:

1. **The empty-`material` production bug has no tracking artifact.** It is documented in code comments, in Engram (`sdd/e2e-coverage/apply-progress-pr1`), and in the now-merged PR #66 body — but `gh issue list --state all` shows no issue for it, and there is no OpenSpec change proposing the fix. Once this change is archived, the only surviving pointers are two inline test comments. This is a live user-facing 500 on a normal admin action. Recommend opening a tracking issue or an OpenSpec change before archive. (Flagging the *tracking* gap, not re-litigating the accepted decision to leave it unfixed here.)
2. **PR 1 shipped ~424 changed lines against a 400-line review budget** (forecast was ~260–340). The overrun was noticed and reasoned about in apply-progress, but neither `tasks.md`'s Review Workload Forecast nor a `size:exception` marker was updated to record the accepted exception, so the artifacts still claim a ~260–340 forecast that reality exceeded. Process/traceability gap only; the code is fine and the review already happened.
3. **`design.md` is stale in two places relative to shipped code**: the Interfaces selector table still lists `#product-title` for the detail error, and the `adminApi` snippet still omits `mkdirSync` / `storageState: undefined`. Both deviations are correctly captured elsewhere (tasks.md 9.1, Engram #6456), so no information is lost, but a reader of `design.md` alone would be misled.

**SUGGESTION**:

1. **Leftover debug instrumentation.** `product-states.spec.ts:5` and `:39` register `page.on('console', msg => console.log(...))`, which floods every suite run with `[Browser Console] [vite] connecting...` noise (clearly visible in the captured run output). It served debugging during apply and no assertion depends on it. Not a policy violation — the repo's no-`console.log` CI guard is `frontend:quality-check`, scoped to `frontend/`, and this is a test file — but it degrades CI log readability. Consider removing.
2. **"No user MUST be created" is asserted only transitively** in both registration-rejection scenarios. The tests assert the exact error string plus the URL staying `/register`, which does imply no session was issued and no redirect happened; and for missing-image, `UserApiController.register` returns 400 before `registerUserUseCase.execute()` is ever reached, while duplicate-email is additionally blocked by the DB unique constraint. So the clause is structurally safe. But tasks 7.1/7.2 both literally said "no new user created", and no direct existence check was written. A single `GET /api/users` assertion would close it cheaply.
3. **Record Strict TDD N/A explicitly.** Apply-progress omitted a TDD Cycle Evidence table rather than declaring it non-applicable. For a test-only change over shipped behavior that is the correct substance, but future verify runs shouldn't have to re-derive the justification.

### Verdict

**PASS WITH WARNINGS**

All 22 tasks complete, all 14 spec scenarios covered by tests that passed at runtime across 3 consecutive clean-state runs, zero production code touched, and all backend gates green. The 3 warnings are traceability and follow-up-tracking gaps, not defects in the shipped change; none blocks archive, though WARNING 1 (untracked production bug) should be converted into a real tracking artifact so it survives archival.
