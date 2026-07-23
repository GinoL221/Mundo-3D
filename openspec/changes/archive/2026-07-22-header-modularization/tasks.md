# Tasks: Header Browser-Behavior Modularization

## Review Workload Forecast

| Field                   | Value                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| Estimated changed lines | Production 285–315; tests 65–80; total 350–395                         |
| 400-line budget risk    | Medium                                                                 |
| Chained PRs recommended | No                                                                     |
| Suggested split         | One PR, three reviewable work units; stop if authored diff exceeds 400 |
| Delivery strategy       | ask-always                                                             |
| Chain strategy          | pending                                                                |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

Coverage key: R1 session/navigation (S1–S2); R2 logout (S3); R3 color (S4); R4 first-paint (S5); R5 CRT (S6–S7); R6 cart (S8–S9); R7 auth E2E (S10–S13); S14 duplicate-init/cleanup.

### Suggested Work Units

| Unit | Goal                                          | Likely PR | Focused test command                                                                                | Runtime harness                                        | Rollback boundary                                                       |
| ---- | --------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| 1    | Session, visual controls, and RED/GREEN tests | PR 1      | `pnpm --filter frontend exec vitest run src/scripts/header-modules.test.ts`                         | N/A; browser behavior is exercised by Unit 3           | Revert `sessionUI.ts`, `themeToggle.ts`, `crtToggle.ts` and their tests |
| 2    | Cart badge and explicit Header wiring         | PR 1      | Same focused Vitest command                                                                         | N/A; wiring is covered by Unit 3                       | Revert `cartBadge.ts` and `Header.astro` wiring                         |
| 3    | First-paint/auth E2E and repository gates     | PR 1      | `pnpm --filter e2e exec playwright test tests/header.spec.ts tests/auth.spec.ts --project=chromium` | Playwright web servers from `e2e/playwright.config.ts` | Revert `e2e/tests/header.spec.ts` and verification-only edits           |

## Phase 1: RED Tests / Contracts

- [x] 1.1 Create `frontend/src/scripts/header-modules.test.ts` fixture and failing session tests for guest/user/admin visibility, storage/session-changed updates, corrupt storage, handler-free search (R1/S1–S2), and logout order (R2/S3).
- [x] 1.2 Add failing visual tests for `theme` defaults/invalid normalization/toggle persistence, CRT enabled/disabled persistence, and duplicate-init/idempotent cleanup (R3–R5/S4–S7, S14).
- [x] 1.3 Add failing cart tests for `loadCartFromStorage()` → initial distinct count → Nano Store updates, empty hiding, unsubscribe, and cleanup (R6/S8–S9).
- [x] 1.4 Create `e2e/tests/header.spec.ts` with the single failing persisted-preference/first-paint regression (R4/S5); do not add threat tests because the design matrix is N/A.

## Phase 2: GREEN Modules

- [x] 2.1 Create `frontend/src/scripts/sessionUI.ts` with explicit initialization, rendering, listeners, idempotent cleanup, and logout ordering: remove `token`, remove `user`, clear cart, assign `/login`.
- [x] 2.2 Create `themeToggle.ts` and `crtToggle.ts` with browser-only dependencies, defaults, normalization, persistence, DOM state/icon updates, and cleanup guards; leave `Layout.astro` unchanged.
- [x] 2.3 Create `frontend/src/scripts/cartBadge.ts` preserving load, initial render, distinct-item count, Nano Store subscription, and unsubscribe cleanup.

## Phase 3: Integration / Verification

- [x] 3.1 Modify `frontend/src/components/Header.astro` only to import and call all four initializers from the processed script; preserve markup, selectors, accessibility, search, and non-goals.
- [x] 3.2 Make the RED tests pass, then refactor only within the four modules and fixture without changing behavior; retain the coverage key’s 7 requirements and 14 cases, with R7/S10–S13 in existing auth coverage.
- [x] 3.3 Run focused Vitest, `tests/auth.spec.ts`, and `tests/header.spec.ts`; run `pnpm test`, `pnpm type-check`, `pnpm --filter frontend build`, and `pnpm lint`.
- [x] 3.4 Inspect `git diff --stat` and count authored additions plus deletions; require total ≤400, confirm `Layout.astro` and domain APIs are untouched, and have `sdd-apply` check tasks incrementally only after implementation and required evidence pass; failed or unexecuted tasks remain unchecked, and intent alone never completes a task.

## Focused Verification Remediation

Authorized scope: add missing passing runtime coverage only; production behavior, source modules, Header markup, E2E scope, dependencies, and unrelated cleanup remain unchanged.

- [x] R1 Add a behavior-realistic module-boundary test for S2 that preserves normal and dropdown link destinations and activates the visual-only search without adding a handler or navigation behavior.
- [x] R2 Add passing runtime coverage for S4 covering absent, valid light, and invalid theme hydration, icon state, and toggle persistence.
- [x] R3 Add passing runtime coverage for S6 covering enabled CRT hydration, toggle-to-disabled behavior, persisted preference, class state, and icon state.

### Remediation Evidence

- Focused Vitest: `pnpm --filter frontend exec vitest run src/scripts/header-modules.test.ts` — exit 0; 1 file, 8 tests passed.
- Frontend check suite: `pnpm --filter frontend exec vitest run` — exit 0; 7 files, 93 tests passed.
- Check-only formatting: `pnpm exec prettier --check frontend/src/scripts/header-modules.test.ts` — exit 0; file formatted.
- Runtime boundary: Vitest executes the module initializers against a DOM-like Header fixture; S2, S4, and S6 each have passing behavioral assertions. No separate E2E test was added because the authorization limits this remediation to the focused module test file.
- Rollback boundary: revert only `frontend/src/scripts/header-modules.test.ts` remediation additions and this remediation section; production files and the original SDD implementation remain untouched.
- Correction lines relative to the pre-remediation test candidate: additions and deletions are reported separately in the apply-progress artifact.

## Final Verification Remediation

Authorized final targeted continuation: test-only coverage for the previously rejected S2 real Header runtime proof and the S8 active Nano Store subscription lifecycle. No production, Header markup, module, spec, proposal, design, dependency, config, or unrelated test files were changed.

- [x] F1 Add valid real-browser S2 coverage for normal Header navigation, keyboard-focus dropdown exposure/use through `:focus-within`, and visual-only search.
- [x] F2 Add active-subscription S8 coverage for empty initialization, non-empty distinct-count update, empty hiding, cleanup, and detached-store non-reaction.

### Final Verification Remediation Evidence

| Task    | Test File                                     | Layer                        | RED                                                                                                                                                                                     | GREEN                                                                                                                                    | TRIANGULATE                                                             | REFACTOR                                  |
| ------- | --------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| F1 / S2 | `e2e/tests/header.spec.ts`                    | Real Playwright browser      | ✅ Initial real Header attempt failed because the actual dropdown remained hidden until its trigger was exposed; this rejected fake-fixture-only proof and drove the focused correction | ✅ Header-only Playwright passed 2/2; normal `/products`, focused `:focus-within` `/profile`, and search no-navigation assertions passed | ✅ Normal link, dropdown link, visual-only search                       | ✅ Focused files normalized with Prettier |
| F2 / S8 | `frontend/src/scripts/header-modules.test.ts` | Vitest module/store boundary | ✅ Existing 8/8 baseline exposed the prior gap: no active non-empty→empty mutation sequence; no production change was needed                                                            | ✅ Focused Vitest passed 8/8; empty→2 distinct items→hidden→cleanup detached state passed                                                | ✅ Initial empty, active non-empty, active empty, post-cleanup mutation | ✅ Focused file normalized with Prettier  |

### Final Work Unit Evidence

| Evidence                                          | Result                                                                                                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result             | `pnpm --filter frontend exec vitest run src/scripts/header-modules.test.ts` — exit 0; 1 file, 8 tests passed                                                                                                                |
| Runtime harness command/scenario and exact result | `pnpm --filter e2e exec playwright test tests/header.spec.ts --project=chromium` — exit 0; 2 real-browser Header tests passed                                                                                               |
| Relevant check commands and exact result          | `pnpm --filter frontend exec vitest run` — exit 0; 7 files, 93 tests; `pnpm --filter e2e exec playwright test tests/header.spec.ts tests/auth.spec.ts --project=chromium` — exit 0; 6 tests                                 |
| Formatting command and exact result               | `pnpm exec prettier --write e2e/tests/header.spec.ts frontend/src/scripts/header-modules.test.ts` — exit 0; both changed test files normalized; repository-wide formatter not run                                           |
| Rollback boundary                                 | Revert only `e2e/tests/header.spec.ts`, the S8 mutation assertions in `frontend/src/scripts/header-modules.test.ts`, and these final evidence sections; production behavior and prior implementation evidence remain intact |

### Final Correction Accounting

- Relative to the current candidate at continuation start: `e2e/tests/header.spec.ts` **32 additions / 0 deletions**; `frontend/src/scripts/header-modules.test.ts` **17 additions / 10 deletions**; total **49 additions / 10 deletions = 59 authored correction lines**.
- The unavailable `/tmp/opencode/header-modularization-remediated-verification-evidence.json` was not reused; the latest failed evidence was reconciled from the persisted Engram verification record.
