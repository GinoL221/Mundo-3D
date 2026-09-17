# Recover frontend workshop corrections

## Objective

Restore the already-implemented frontend corrections that were removed from the current branch history, without reimplementing unrelated work or committing/pushing changes.

## Problem and rationale

The current worktree is based on `main`, while the visual corrections were previously recorded in an unreferenced local commit chain. The correction objects remain recoverable through Git reflog/object storage. The safe approach is to preserve the chain, compare it with the current source, and port only the authorized home, authentication, and cart behavior.

## Scope

- Preserve the recovery point at `5221921` locally.
- Port the recovered home responsive corrections.
- Port the recovered login/register surface corrections.
- Port the recovered editable cart controls and resolved image-path behavior.
- Run focused checks and responsive visual verification.

## Constraints

- Do not commit, stage, push, pull, or mutate remote branches.
- Preserve existing untracked artifacts: `.impeccable/`, `e2e/playwright-report/`, `frontend/.impeccable/questions/`, and `.gentle-ai-instance` files.
- Do not reintroduce unrelated product, help, security, or email-confirmation changes from the recovery chain.
- Keep local demo behavior and production/deployment work separate.

## Tasks

### REC-01 — Pin recovered commits

- Create a local recovery reference at `5221921`.
- Confirm the current worktree status and keep all existing user changes intact.

### REC-02 — Port home responsive corrections

- Restore the recovered desktop CTA layout and header active-state treatment.
- Disable the Astro development toolbar for deterministic responsive captures.
- Preserve mobile/tablet behavior and current design-system tokens.

### REC-03 — Port authentication surface corrections

- Restore the recovered login/register component and page surface changes.
- Preserve email-confirmation behavior and accessibility contracts.

### REC-04 — Port cart corrections

- Restore editable quantity controls and state updates.
- Restore resolved image-path behavior without inventing assets.

### REC-05 — Verify and close

- Run focused frontend tests and the repository frontend check.
- Run the Impeccable detector once over changed UI targets.
- Inspect responsive screenshots or bounded browser evidence.
- Record any failed, skipped, or pending check honestly.

### REC-06 — Resolve verification blockers

- Re-run responsive snapshots without the host inspection toolbar contaminating screenshots.
- Reconcile the pre-existing fast-failure redirect timing assertion if it remains above its local threshold.
- Do not update snapshots from contaminated captures.

### REC-07 — Re-enter native review

- Obtain a fresh native review consent/lineage for the current candidate.
- Do not reuse the expired consent bindings returned by the stale authority.
- Keep delivery decisions separate from review outcome.

## Acceptance criteria

- Home desktop CTAs render in a row and the desktop header does not retain the mobile active-link stripe.
- Login and register use the recovered coherent surface without regressing submission, validation, or confirmation flows.
- Cart exposes accessible decrease/increase controls, updates quantities/subtotals, and keeps valid product image paths.
- Existing untracked files remain untouched.
- Verification evidence is recorded before reporting completion.

## Checks

- `pnpm --filter frontend test`
- `pnpm frontend:check`
- `./.pi/skills/impeccable/scripts/impeccable detect --json <changed targets>`
- Responsive browser/screenshot inspection for home, auth, and cart.

## Progress

- [x] Located the recovery chain in Git reflog/object storage.
- [x] Pinned `recover/frontend-workshop-corrections` at `5221921`.
- [x] Ported home responsive corrections.
- [x] Ported auth corrections.
- [x] Ported cart corrections.
- [x] Restored the recovered Astro dev-toolbar configuration.
- [x] Ran frontend tests, frontend check, detector, and responsive visual verification.
- [x] Resolved host-overlay and cart timing verification blockers.
- [ ] Re-enter native RDD review with a fresh consent/lineage.

## Verification evidence

- `pnpm --filter frontend test` — passed; 27 files, 310 tests.
- `pnpm frontend:check` — passed; 0 errors, 0 warnings.
- Impeccable detector — passed with no findings.
- Parent lens diagnostics — no blocking findings in edited files; unrelated pre-existing warnings remain elsewhere.
- Snapshot artifacts for 1024, 1440, 320, and 768 match the pinned recovery branch byte-for-byte.
- Independent post-correction E2E run — passed 54/54 across home remediation, all home responsive snapshots, auth, and cart.
- Current full Chromium command `pnpm --filter e2e test --project=chromium` — exit 0, 108/108 passed; no snapshot updates and generated reports left untouched.
- The latest external 50-pass/4-fail report did not reproduce against the current on-disk candidate.
- The Astro dev toolbar was the source of the apparent mobile/tablet screenshot mismatch; disabling it restored deterministic captures.
- The previously slow cart redirect assertion passed in the clean post-correction run.
- Native RDD review start was attempted twice for the current candidate but returned an expired consent binding for an older target; no lineage or mutation was created. ASSESS therefore treated native review as unavailable and required the independent verifier, which passed.

## Scope note

The recovered cart badge unit-count test was intentionally not ported because the current badge contract reports line count and that implementation is outside the authorized edit surfaces. Image URL resolution already preserves app-relative product assets, so no resolver change was needed.

## Next step

Technical verification is complete, but native RDD review remains pending because the controller returned a stale consent binding for an older candidate. Keep all changes unstaged and uncommitted until fresh review authority is available and the user explicitly authorizes delivery.
