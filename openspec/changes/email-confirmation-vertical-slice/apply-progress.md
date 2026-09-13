# Apply Progress: Email Confirmation Vertical Slice

## Slice 1 — persistence foundation (partial)

**Status:** blocked at a coherent RED/GREEN boundary by the 400 changed-line review budget. No task checkbox was marked complete because the first implementation-owned RED/GREEN task also requires real-MySQL migration evidence and Sequelize/domain model mappings, which are not yet implemented.

### Completed work

- Added `20260902000000-email-confirmation.js` as an additive migration foundation.
  - Adds nullable `User.email_verified_at` and backfills existing rows with one captured migration timestamp.
  - Creates digest-only `EmailConfirmationToken` storage with user FK cascade, unique digest, `(id_user, active_slot)` authority, and user/created-at index.
  - Drops the token table before the user column in `down`.
  - Attributes statement failures because MySQL DDL auto-commits despite the conventional transaction scope.
- Added focused migration unit tests for schema shape, captured backfill parameter, dependency-safe rollback order, and failure diagnostics.

### Persisted task checkboxes

None. The following implementation task remains unchecked because it requires real-MySQL evidence not yet added:

- [ ] **RED — add real-MySQL migration tests** for captured-timestamp backfill of pre-existing users, null default for post-migration users, digest-only token fields, FK/indexes including one `(id_user, active_slot=1)` authority, and dependency-safe down behavior. Run `pnpm --filter backend test:integration -- --runInBand backend/src/database`. <!-- sdd-owner: implementation -->
- [ ] **GREEN — implement the additive migration and Sequelize mappings**: add nullable `User.emailVerifiedAt`/`email_verified_at`, create the digest-only token table with expiry/consumed/invalidated/active-slot timestamps and indexes, register association/types, and implement down as token table first then user column; record statement-attributed migration errors because MySQL DDL auto-commits. Run the focused real-DB migration command. <!-- sdd-owner: implementation -->

### TDD Cycle Evidence

| Task                                 | Test file                                                                             | Layer | Safety net                          | RED                                     | GREEN                                     | TRIANGULATE                                                  | REFACTOR                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------- | ----- | ----------------------------------- | --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Migration foundation (partial GREEN) | `backend/src/database/migrations/__tests__/20260902000000-email-confirmation.test.js` | Unit  | 24/24 existing focused tests passed | Missing migration module failed to load | 2/2 passed after migration implementation | Deferred to required real-MySQL cases in next budgeted slice | No behavior refactor needed; source is 92 lines |

### Test commands run

- `pnpm --filter backend test -- --runInBand backend/src/database/models/__tests__/UserModel.test.js backend/src/database/models/__tests__/RememberTokenModel.test.js backend/src/database/models/__tests__/index.test.js backend/src/database/migrations/__tests__/20260724000000-baseline.test.js backend/src/application/__tests__/DomainEntities.test.ts` — passed (5 suites, 24 tests).
- `pnpm --filter backend test -- --runInBand backend/src/database/migrations/__tests__/20260902000000-email-confirmation.test.js` — RED failed as expected because the migration did not exist.
- Same focused migration command — GREEN passed (1 suite, 2 tests).

### Files changed

- `backend/src/database/migrations/20260902000000-email-confirmation.js`
- `backend/src/database/migrations/__tests__/20260902000000-email-confirmation.test.js`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Workload and next boundary

The authored migration and unit test are 153 lines before progress evidence. Adding the mandatory real-MySQL migration test plus User/token model, registry, type, and internal entity mappings with their tests would exceed the 400-line slice budget. The next dependency-safe slice starts with real-MySQL migration triangulation, then completes the model/entity mapping and its focused tests. No unrelated files, routes, registration wiring, SMTP/Mailpit, resend, frontend, or access behavior were changed.

### Status consumed

- `applyState: ready`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`.
- Delivery path: first `stacked-to-main` slice; 400 changed-line budget.
- Pre-existing worktree changes were observed before editing and were not modified.

## Slice 1 — persistence-model (bounded attempt)

**Status:** blocked before RED. The inherited candidate already occupies 202 changed lines (97-line migration, 56-line migration test, and 49-line progress artifact), leaving 198 lines in this 400-line objective. The required real-MySQL proof needs a migration-runner integration test, while the required User/token Sequelize registry, declaration, and domain mappings need focused model/entity tests; those are collectively larger than the remaining budget. The existing scratch migration integration surface is outside this slice's allowed edit roots, so it cannot be extended here.

### TDD Cycle Evidence

| Task                              | Test file                                     | Layer | Safety net                 | RED                                                                                                  | GREEN       | TRIANGULATE | REFACTOR                         |
| --------------------------------- | --------------------------------------------- | ----- | -------------------------- | ---------------------------------------------------------------------------------------------------- | ----------- | ----------- | -------------------------------- |
| Persistence-model bounded attempt | Existing migration/model/entity focused tests | Unit  | Passed: 4 suites, 21 tests | Not started: a real-MySQL RED test cannot fit with the dependent mappings in the remaining 198 lines | Not started | Not started | No production refactor performed |

### Test command run

- `pnpm --filter backend test -- --runInBand backend/src/database/migrations/__tests__/20260902000000-email-confirmation.test.js backend/src/database/models/__tests__/UserModel.test.js backend/src/database/models/__tests__/index.test.js backend/src/application/__tests__/DomainEntities.test.ts` — passed (4 suites, 21 tests).

### Budget and next boundary

- Native objective budget: 400 changed lines; inherited candidate: 202 lines; remaining before this progress update: 198 lines.
- No implementation task was completed or checked because no RED/GREEN/Triangulate/Refactor cycle was begun in this attempt.
- Next narrower stacked slice: allow `backend/src/database/__tests__/migrate.integration.test.js` (or designate a new permitted `*.integration.test.js` migration-runner test) and allocate its real-MySQL proof independently; then follow with User/token model, registry, `db.d.ts`, and internal entity mappings plus focused tests as a separate bounded work unit.

## Slice 1 — migration-integration

**Status:** completed bounded real-MySQL migration evidence. The broader Sequelize mapping task remains intentionally unchecked for its later slice.

### Completed task and persisted checkbox

- [x] **RED — add real-MySQL migration tests** for captured-timestamp backfill of pre-existing users, null default for post-migration users, digest-only token fields, FK/indexes including one `(id_user, active_slot=1)` authority, and dependency-safe down behavior. <!-- sdd-owner: implementation -->

### TDD Cycle Evidence

| Task                      | Test file                                                    | Layer      | Safety net                                                                | RED                                                                                   | GREEN                                                                                                   | TRIANGULATE                                                                                                                                    | REFACTOR                                                                                          |
| ------------------------- | ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Migration-runner evidence | `backend/src/database/__tests__/migrate.integration.test.js` | Real MySQL | Existing suite: 4/7 passed; failures exposed untracked migration behavior | Added runner assertions for the missing fourth migration and its real schema behavior | Replaced the ineffective raw `@migrationTimestamp` update with `bulkUpdate`; focused runner: 8/8 passed | Added two pre-existing users sharing one captured timestamp, duplicate-active rejection, multiple null slots, cascade, and ordered down checks | Used query-interface methods so every DDL step stays statement-attributed; migration is 139 lines |

### Verification evidence

- `pnpm --filter backend test:integration -- --runInBand backend/src/database` — passed (1 suite, 8 tests).
- `pnpm --filter backend test -- --runInBand backend/src/database` — passed (16 suites, 56 tests).
- `pnpm --filter backend test -- --runInBand backend/src/database/migrations/__tests__/20260902000000-email-confirmation.test.js` — passed (1 suite, 2 tests).

### Files changed

- `backend/src/database/migrations/20260902000000-email-confirmation.js`
- `backend/src/database/migrations/__tests__/20260902000000-email-confirmation.test.js`
- `backend/src/database/__tests__/migrate.integration.test.js`
- `openspec/changes/email-confirmation-vertical-slice/tasks.md`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Scope, workload, and remaining tasks

- Work-unit boundary: `migration-integration` in the first stacked-to-main slice; no Sequelize mappings, models, domain entities, routes, registration wiring, SMTP/Mailpit, frontend, or unrelated paths changed.
- Candidate code diff is 323 lines (303 additions, 20 deletions) before the two required OpenSpec artifact updates, within the 400-line budget.
- Remaining next implementation task: `- [ ] **GREEN — implement the additive migration and Sequelize mappings**: add nullable \`User.emailVerifiedAt\`/\`email_verified_at\`, create the digest-only token table with expiry/consumed/invalidated/active-slot timestamps and indexes, register association/types, and implement down as token table first then user column; record statement-attributed migration errors because MySQL DDL auto-commits. Run the focused real-DB migration command. <!-- sdd-owner: implementation -->`
- Deviation: the existing raw migration backfill used unsupported `@migrationTimestamp` replacement syntax in the real runner; this slice corrected it with `queryInterface.bulkUpdate`, retaining the intended captured timestamp and statement-attributed DDL failure context.

### Status consumed

- `applyState: ready`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`.
- Delivery path: `stacked-to-main`; current bounded work unit: `migration-integration`; native review budget: 400 changed lines.
- Pre-existing tracked and untracked worktree changes were preserved; no commit, stage, reset, stash, push, or unrelated edit occurred.
