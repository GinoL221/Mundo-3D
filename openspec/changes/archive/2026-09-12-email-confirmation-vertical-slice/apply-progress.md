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

## Slice 1 — persistence-model

**Status:** completed. The committed migration foundation is now represented by internal Sequelize and domain mappings without changing public DTOs or existing access/session behavior.

### Completed task and persisted checkbox

- [x] **GREEN — implement the additive migration and Sequelize mappings**: add nullable `User.emailVerifiedAt`/`email_verified_at`, create the digest-only token table with expiry/consumed/invalidated/active-slot timestamps and indexes, register association/types, and implement down as token table first then user column; record statement-attributed migration errors because MySQL DDL auto-commits. <!-- sdd-owner: implementation -->

### TDD Cycle Evidence

| Task                       | Test files                                                                                            | RED                                                                                                       | GREEN                                                                                                                                                          | TRIANGULATE                                                                                                                                        | REFACTOR                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Persistence-model mappings | `UserModel.test.js`, `EmailConfirmationTokenModel.test.js`, `index.test.js`, `DomainEntities.test.ts` | Focused command failed: missing token model; User field, association, and entity state assertions failed. | Added nullable User mapping, digest-only token model, registry/associations, declarations, and internal entities; focused command passed (4 suites, 22 tests). | Added token-entity state coverage and ran the full model/domain focus (10 suites, 30 tests) plus real-MySQL migration evidence (1 suite, 8 tests). | All new production files are below 250 lines; no DTO or application serialization changed. |

### Verification evidence

- `pnpm --filter backend test -- --runInBand backend/src/database/models/__tests__/UserModel.test.js backend/src/database/models/__tests__/EmailConfirmationTokenModel.test.js backend/src/database/models/__tests__/index.test.js backend/src/application/__tests__/DomainEntities.test.ts` — RED failed as expected (4 suites; missing model and mapping assertions).
- Same focused command — GREEN passed (4 suites, 22 tests).
- `pnpm --filter backend test:integration -- --runInBand backend/src/database` — passed (1 suite, 8 tests).
- `pnpm --filter backend test -- --runInBand backend/src/database/models backend/src/application/__tests__/DomainEntities.test.ts` — passed (10 suites, 30 tests).
- `git diff --check` — passed.

### Files changed

- `backend/src/database/models/User.js`
- `backend/src/database/models/EmailConfirmationToken.js`
- `backend/src/database/models/index.js`
- `backend/src/database/models/db.d.ts`
- `backend/src/database/models/__tests__/UserModel.test.js`
- `backend/src/database/models/__tests__/EmailConfirmationTokenModel.test.js`
- `backend/src/database/models/__tests__/index.test.js`
- `backend/src/database/models/__tests__/index.production-connection.test.js`
- `backend/src/domain/entities/User.ts`
- `backend/src/domain/entities/EmailConfirmationToken.ts`
- `backend/src/application/__tests__/DomainEntities.test.ts`
- `openspec/changes/email-confirmation-vertical-slice/tasks.md`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Scope, workload, and remaining tasks

- Work-unit boundary: `persistence-model`, stacked-to-main slice 1. The migration from `e5f605f` was not changed; no DTO, route, controller, registration, SMTP, frontend, or access behavior changed.
- Current work-unit estimate: 262 changed lines (260 additions, 2 deletions), including tests and OpenSpec evidence; below the 400-line review budget.
- Deviation: none from the approved model/entity mapping design. The registry test mocks were extended only with Sequelize types used by the new model.
- Remaining next implementation task: `- [ ] **TRIANGULATE — extend persistence cases** for multiple historical null active slots, duplicate active-slot rejection, cascade behavior, and down safety without changing existing user/session/login/checkout rows. Run \`pnpm --filter backend test:integration -- --runInBand backend/src/database\` and \`pnpm --filter backend test -- --runInBand backend/src/database\`. <!-- sdd-owner: implementation -->`

### Status consumed

- `applyState: ready`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`.
- Delivery path: resolved `stacked-to-main`; native review budget: 400 changed lines.
- Pre-existing tracked and untracked worktree changes were preserved; no commit, stage, reset, stash, push, or unrelated edit occurred.

## Slice 1 — persistence-triangulate

**Status:** completed without source changes. The existing real-MySQL migration integration test already contains the four assigned focused regressions, so no duplicate assertion or production change was added.

### Completed task and persisted checkbox

- [x] **TRIANGULATE — extend persistence cases** for multiple historical null active slots, duplicate active-slot rejection, cascade behavior, and down safety without changing existing user/session/login/checkout rows. <!-- sdd-owner: implementation -->

### TDD Cycle Evidence

| Task                      | Test file                                                    | Layer                  | Safety net                                      | RED                                                                                   | GREEN                                            | TRIANGULATE                                                                                                                                                                                                                 | REFACTOR                                |
| ------------------------- | ------------------------------------------------------------ | ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Persistence triangulation | `backend/src/database/__tests__/migrate.integration.test.js` | Real MySQL integration | 8/8 integration and 58/58 database tests passed | No new RED was warranted: the committed test already exercises the requested behavior | Existing migration/model behavior remained green | Fresh real-MySQL execution proved two historical `NULL` slots are permitted, a second active slot is rejected, deleting the user cascades token deletion, and migration down drops token storage before `email_verified_at` | No refactor required; no source changed |

### Verification evidence

- `pnpm --filter backend test:integration -- --runInBand backend/src/database` — passed (1 suite, 8 tests).
- `pnpm --filter backend test -- --runInBand backend/src/database` — passed (17 suites, 58 tests).
- The real-MySQL case `creates digest-only storage with real authority, index, and cascade constraints` inserts one active row, rejects a duplicate active row, permits two `active_slot = NULL` historical rows, and confirms cascade deletion.
- The real-MySQL case `down four times removes email-confirmation dependencies before restoring the baseline shape` proves the token table is removed before `User.email_verified_at` and subsequently validates rollback of the existing dependent migration order.

### Files changed

- `openspec/changes/email-confirmation-vertical-slice/tasks.md`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Scope, workload, and next boundary

- Work-unit boundary: `persistence-triangulate`, stacked-to-main slice 1. No production or test source was changed because the required cases were already present and freshly passed.
- Authored diff for this work unit is 41 changed lines (40 additions, 1 deletion), entirely OpenSpec task/progress evidence; it is within the 400-line review budget.
- Deviation: none. Existing proof also checks the ordered rollback against the baseline/order/refresh-token migration sequence, providing stronger down-safety evidence than a duplicated unit-only assertion.
- Next implementation task is ready: `- [ ] **REFACTOR — keep migration/model files below 250 source lines** and make entity mapping internal-only; confirm no public DTO gains \`emailVerifiedAt\`. Run \`pnpm --filter backend test -- --runInBand backend/src/database backend/src/application/**tests**/DomainEntities.test.ts\`. <!-- sdd-owner: implementation -->`

### Status consumed

- `applyState: ready`; `nextRecommended: sdd-apply`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`.
- Delivery path: resolved `stacked-to-main`; current bounded work unit: `persistence-triangulate`; native review budget: 400 changed lines.
- Pre-existing tracked and untracked worktree changes were preserved; no commit, stage, reset, stash, push, or unrelated edit occurred.

## Slice 1 — persistence-refactor

**Status:** completed without production or test-source changes. The committed migration/model/entity structure already meets the file-size and internal-mapping constraints, so duplicating approval tests or extracting code would not improve the implementation.

### Completed task and persisted checkbox

- [x] **REFACTOR — keep migration/model files below 250 source lines** and make entity mapping internal-only; confirm no public DTO gains `emailVerifiedAt`. Run `pnpm --filter backend test -- --runInBand backend/src/database backend/src/application/__tests__/DomainEntities.test.ts`. <!-- sdd-owner: implementation -->

### Structural proof

- Individual production file line counts: migration `139`; `models/User.js` `87`; `models/EmailConfirmationToken.js` `55`; `models/index.js` `84`; `models/db.d.ts` `151`; domain `User.ts` `13`; domain `EmailConfirmationToken.ts` `12`. Every file is below the 250-source-line limit.
- `emailVerifiedAt` exists only in the internal Sequelize `User` mapping, database typing, and domain `User` entity. `EmailConfirmationToken` is a separate internal digest-only entity.
- Public inspection: `backend/src/application/dtos/UserDTO.ts` has only `idUser`, `firstName`, `lastName`, `email`, `image`, `idRole`, and `category`; the cookie-session `UserAuthDto` has the same public shape. CodeGraph traced the DTO callers and found no `emailVerifiedAt` exposure path.
- No routes, sessions, login, cart, checkout, roles, migrations, DTOs, or production mappings changed in this work unit.

### TDD Cycle Evidence

| Task                               | Test file                                                                             | Layer                 | Safety net                      | RED                                                                                       | GREEN                            | TRIANGULATE                                                                                                           | REFACTOR                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------- | --------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Persistence mapping refactor proof | `backend/src/database/**`, `backend/src/application/__tests__/DomainEntities.test.ts` | Unit/model regression | `18` suites / `75` tests passed | No new RED: this bounded refactor found no missing behavior or concrete structural defect | Existing mappings remained green | Existing model/entity tests cover nullable mapping, digest-only token fields, associations, and internal entity state | No production refactor warranted; line-count and DTO-boundary inspection passed |

### Verification evidence

- `pnpm --filter backend test -- --runInBand backend/src/database backend/src/application/__tests__/DomainEntities.test.ts` — passed (18 suites, 75 tests).
- `git diff --check` — passed before the OpenSpec artifact updates.

### Files changed

- `openspec/changes/email-confirmation-vertical-slice/tasks.md`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Scope, workload, and next boundary

- Work-unit boundary: `persistence-refactor`, stacked-to-main slice 1. This work unit authored 46 OpenSpec artifact lines (44 progress additions plus one checkbox replacement: one addition and one deletion); no production or test-source lines changed, so the work unit remains well below the 400-line budget. The worktree's cumulative OpenSpec diff is 87 lines because prior slice evidence was already uncommitted.
- Deviation: none. A no-source-change refactor proof is intentional because all inspected files already satisfy the required structure and behavior.
- The next domain/security RED task is ready (see `tasks.md`): write unit tests for trim/lowercase normalization, 32-byte CSPRNG base64url token output, SHA-256 lowercase-hex digest, a clock-controlled exact 24-hour expiry, approved non-secret record-id idempotency keys, trusted-origin URL acceptance/rejection, and unchanged DTO serialization. Tests exercise the deployment-owned `PUBLIC_APP_URL` parser through the origin port. Run `pnpm --filter backend test -- --runInBand backend/src/domain backend/src/infrastructure/security backend/src/infrastructure/config`. <!-- sdd-owner: implementation -->
- Remaining unchecked implementation tasks: 32; parent lifecycle tasks remain deferred and unchecked.

### Status consumed

- `applyState: ready`; `nextRecommended: sdd-apply`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`.
- Delivery path: resolved `stacked-to-main`; bounded work unit: `persistence-refactor`; native review budget: 400 changed lines.
- Pre-existing tracked and untracked worktree changes were preserved; no commit, stage, reset, stash, push, or unrelated edit occurred.

## Slice 1 — domain-security-red

**Status:** completed RED-only work unit. Production primitives remain intentionally unimplemented for the next GREEN work unit.

### Completed task and persisted checkbox

- [x] **RED — write unit tests** for trim/lowercase normalization, 32-byte CSPRNG base64url token output, SHA-256 lowercase-hex digest, a clock-controlled exact 24-hour expiry, approved non-secret record-id idempotency keys, trusted-origin URL acceptance/rejection, and unchanged DTO serialization. Tests exercise the deployment-owned `PUBLIC_APP_URL` parser through the origin port. <!-- sdd-owner: implementation -->

### TDD Cycle Evidence

| Task                       | Test files                                                                                                                                                                | Layer | Safety net                                    | RED                                                                                                                                | GREEN                                 | TRIANGULATE                                                                              | REFACTOR                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------ |
| Domain/security primitives | `NormalizedEmail.test.ts`, `EmailConfirmationToken.test.ts`, `CryptoConfirmationTokenGenerator.test.ts`, `emailConfirmationConfig.test.ts`, `RegisterUserUseCase.test.ts` | Unit  | Focused baseline: 10 suites / 81 tests passed | Focused command: 4 suites failed as expected; missing normalization, CSPRNG, and config modules plus missing pending-token methods | Deferred: RED-only assigned work unit | Multiple normalization, origin, and token-shape cases written before any production code | Deferred: no production code changed |

### Verification evidence

- Baseline: `pnpm --filter backend test -- --runInBand backend/src/domain backend/src/infrastructure/security backend/src/infrastructure/config` — passed (10 suites, 81 tests).
- RED: same focused command — failed as expected (4 suites failed, 10 passed; 2 failing assertions, 81 passing tests). The failures are `Cannot find module '../NormalizedEmail'`, `Cannot find module '../CryptoConfirmationTokenGenerator'`, `Cannot find module '../emailConfirmationConfig'`, and absent `EmailConfirmationToken.createPending` / `deliveryIdempotencyKey` methods.
- DTO regression: `pnpm --filter backend test -- --runInBand backend/src/application/__tests__/RegisterUserUseCase.test.ts` — passed (1 suite, 6 tests), including an internally verified user whose registration DTO has no verification field.

### Files changed

- `backend/src/domain/entities/__tests__/NormalizedEmail.test.ts`
- `backend/src/domain/entities/__tests__/EmailConfirmationToken.test.ts`
- `backend/src/infrastructure/security/__tests__/CryptoConfirmationTokenGenerator.test.ts`
- `backend/src/infrastructure/config/__tests__/emailConfirmationConfig.test.ts`
- `backend/src/application/__tests__/RegisterUserUseCase.test.ts`
- `openspec/changes/email-confirmation-vertical-slice/tasks.md`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Scope, workload, and next boundary

- Work-unit boundary: `domain-security-red`, stacked-to-main slice 1. Estimated authored diff: 185 changed lines, within the 400-line review budget. No production primitive, issuance, confirmation, registration wiring, resend, SMTP, route, frontend, or E2E code changed.
- Deviation: `EmailConfirmationToken` owns the RED timing and record-id identity contract in the tests, keeping calculation and key formation out of infrastructure and preventing email/token/URL material from becoming a delivery key.
- The domain/security GREEN task is ready: `- [ ] **GREEN — add domain entities, exceptions, and ports plus crypto/config adapters** with no infrastructure imports from domain; origin validation rejects credentials/query/fragment/non-root paths and requires HTTPS outside localhost demo. Run the focused backend command. <!-- sdd-owner: implementation -->`
- Other implementation tasks remain unchecked in `tasks.md`; parent lifecycle rows remain deferred and unchecked.

### Status consumed

- `applyState: ready`; `nextRecommended: sdd-apply`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`.
- Delivery path: resolved `stacked-to-main`; bounded work unit: `domain-security-red`; native review budget: 400 changed lines.
- RED compiler diagnostics are intentional missing-production evidence and must not be resolved until the assigned GREEN work unit. No commit, stage, reset, stash, push, or unrelated edit occurred.

## Slice 1 — domain-security-green

**Status:** blocked during the GREEN verification gate by a pre-existing SHA-256 test-vector mismatch. The new domain/config/CSPRNG production primitives compile and their tests pass, but the focused command cannot be declared green while the unchanged SHA-256 adapter returns the standard digest that differs from the RED assertion.

### TDD Cycle Evidence

| Task                  | Test files                                                                                                                                 | Layer | RED                                                    | GREEN                                                                         | TRIANGULATE                   | REFACTOR    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------- | ----------- |
| Domain/security GREEN | `NormalizedEmail.test.ts`, `EmailConfirmationToken.test.ts`, `CryptoConfirmationTokenGenerator.test.ts`, `emailConfirmationConfig.test.ts` | Unit  | Completed in preceding `domain-security-red` work unit | Blocked: 13 suites / 93 tests passed, but the SHA-256 vector assertion failed | Deferred to next ordered task | Not started |

### Verification evidence

- `pnpm --filter backend test -- --runInBand backend/src/domain backend/src/infrastructure/security backend/src/infrastructure/config` — failed: 13 suites and 93 tests passed; one SHA-256 assertion failed.
- The unchanged `Sha256TokenHasher` returns `23a0f8a5d44eb66f9f082c737258aaf003ccf023127f695078f39fd7f57cd2e6` for the exact test input `confirmation-token`, the standard SHA-256 digest. The RED assertion expects `4a1958834191a18850db70dc8ee2aa97cf7f49e2e672e868e3a30d6ed7aa6f7d`, which does not match that input's SHA-256 digest.

### Files changed

- `backend/src/domain/entities/NormalizedEmail.ts`
- `backend/src/domain/entities/EmailConfirmationToken.ts`
- `backend/src/domain/ports/TokenGeneratorPort.ts`
- `backend/src/domain/ports/ConfirmationTokenGeneratorPort.ts`
- `backend/src/domain/ports/PublicOriginPort.ts`
- `backend/src/domain/ports/ClockPort.ts`
- `backend/src/domain/ports/EmailConfirmationIssuerPort.ts`
- `backend/src/domain/ports/EmailConfirmationRateLimitPort.ts`
- `backend/src/domain/exceptions/InvalidEmailConfirmationToken.ts`
- `backend/src/infrastructure/security/CryptoConfirmationTokenGenerator.ts`
- `backend/src/infrastructure/config/emailConfirmationConfig.ts`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Blocker and next boundary

- The assigned GREEN checkbox remains unchecked because the required focused command is not green.
- The SHA-256 adapter is shared with existing token flows. Altering its standards-compliant digest output merely to satisfy the incorrect vector would violate the task's SHA-256 requirement and risk existing authentication behavior; changing the RED assertion would require explicit correction authorization because the task forbids hiding or weakening failures.
- The next domain/security TRIANGULATE task is not ready until the SHA-256 expected vector is resolved and the GREEN task can be completed.
- No routes, controllers, repositories, migrations, session/auth code, registration wiring, SMTP, frontend, or E2E code was changed. No commit, stage, reset, stash, push, or PR action occurred.

### GREEN resolution

- The parent corrected the RED assertion to the standard SHA-256 vector for `confirmation-token`: `23a0f8a5d44eb66f9f082c737258aaf003ccf023127f695078f39fd7f57cd2e6`.
- `pnpm --filter backend test -- --runInBand backend/src/domain backend/src/infrastructure/security backend/src/infrastructure/config` passed: 14 suites / 94 tests.
- The domain/security GREEN task is now complete and its persisted checkbox was updated to `[x]`.
- Deviation: the initial RED SHA-256 expected value was corrected to the standard digest; production hashing behavior was not changed.
- The next ordered domain/security TRIANGULATE task is ready, but no TRIANGULATE work was started in this unit.

## Slice 1 — domain-security-triangulate

**Status:** completed with adversarial regression coverage; no production defect was demonstrated, so no source fix was needed.

### Completed task and persisted checkbox

- [x] **TRIANGULATE — test adversarial inputs**: malformed origins, encoded tokens, different clock values, token collision retry behavior if supported by repository contract, and proof that token/email/URL material is absent from observable DTOs and idempotency keys. <!-- sdd-owner: implementation -->

### TDD Cycle Evidence

| Task                                   | Test files                                                                                         | Layer | Safety net                  | RED                                      | GREEN                                      | TRIANGULATE                                                                                                                                               | REFACTOR                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | ----- | --------------------------- | ---------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Domain/security adversarial boundaries | `EmailConfirmationToken.test.ts`, `emailConfirmationConfig.test.ts`, `RegisterUserUseCase.test.ts` | Unit  | 14 suites / 94 tests passed | Completed by the preceding RED work unit | Completed by the preceding GREEN work unit | Added encoded-token URL, malformed-origin, leap-day clock, secret-safe token-state/idempotency, and DTO-boundary assertions; 14 suites / 100 tests passed | No refactor or production change was warranted |

### Verification evidence

- Baseline: `pnpm --filter backend test -- --runInBand backend/src/domain backend/src/infrastructure/security backend/src/infrastructure/config` — passed (14 suites, 94 tests).
- `pnpm --filter backend test -- --runInBand backend/src/domain backend/src/infrastructure/security backend/src/infrastructure/config` — passed (14 suites, 100 tests).
- `pnpm --filter backend test -- --runInBand backend/src/application/__tests__/RegisterUserUseCase.test.ts` — passed (1 suite, 6 tests).
- `pnpm --filter backend test -- --runInBand backend/src/architecture` — passed (1 suite, 43 tests).
- `git diff --check` — passed.

### Adversarial coverage and deferral

- `PUBLIC_APP_URL` rejects non-absolute, FTP, encoded non-root-path, and deceptive `localhost`-lookalike values; production HTTPS and local HTTP localhost behavior remain unchanged.
- URL construction encodes reserved token characters through `URLSearchParams`; token plaintext is not stored in the token entity, delivery idempotency key, or registration DTO output.
- Pending-token expiry remains exactly 24 hours for a normal timestamp and a leap-day boundary.
- Collision retry is explicitly deferred: no token repository or issuer collision-retry port contract exists in this bounded domain/security slice, so none was invented.

### Files changed

- `backend/src/application/__tests__/RegisterUserUseCase.test.ts`
- `backend/src/domain/entities/__tests__/EmailConfirmationToken.test.ts`
- `backend/src/infrastructure/config/__tests__/emailConfirmationConfig.test.ts`
- `openspec/changes/email-confirmation-vertical-slice/tasks.md`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Scope, workload, and next boundary

- Work-unit boundary: `domain-security-triangulate`, stacked-to-main slice 1. No production source, repository, issuance, confirmation, registration wiring, SMTP, route, frontend, or E2E code changed.
- Estimated authored diff: approximately 85 changed lines, including regression assertions and OpenSpec evidence; it remains below the 400-line budget.
- Deviation: the existing public registration DTO intentionally retains its pre-existing `email` field. The new boundary assertion proves it adds no confirmation token, digest, URL, or verification-state material; delivery idempotency remains record-id-only.
- The domain/security REFACTOR task is ready: `- [ ] **REFACTOR — split contracts/adapters by responsibility** and update architecture-boundary tests if new allowed ports require explicit recognition. Run \`pnpm --filter backend test -- --runInBand backend/src/architecture backend/src/domain backend/src/infrastructure/security\`. <!-- sdd-owner: implementation -->`
- Remaining implementation tasks include the exact unchecked REFACTOR line above; later task groups remain intentionally unchecked.

### Status consumed

- `applyState: ready`; `nextRecommended: apply`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`.
- Delivery path: resolved `stacked-to-main`; current bounded work unit: `domain-security-triangulate`; native review budget: 400 changed lines.
- Existing tracked and untracked worktree files outside the allowed work-unit scope were preserved. No acquire, settle, commit, stage, reset, stash, push, or PR action occurred.

## Slice 1 — domain-security-refactor

**Status:** completed with a no-source-change refactor proof. The existing discrete domain contracts and infrastructure adapters already have one responsibility each, and the architecture checker explicitly permits all `domain/{entities,ports,exceptions}` contracts. No new architecture exception or duplicate test is necessary.

### Completed task and persisted checkbox

- [x] **REFACTOR — split contracts/adapters by responsibility** and update architecture-boundary tests if new allowed ports require explicit recognition. <!-- sdd-owner: implementation -->

### Structural and boundary proof

- `NormalizedEmail` owns pure normalization; `EmailConfirmationToken` owns expiry and non-secret delivery identity; `InvalidEmailConfirmationToken` is the isolated domain outcome.
- Each confirmation port is isolated in its own file. `ConfirmationTokenGeneratorPort` narrows the generic `TokenGeneratorPort`; clock, trusted origin, issuer, and rate-limit seams remain independent.
- `CryptoConfirmationTokenGenerator` adapts Node crypto only; `Sha256TokenHasher` remains the separate digest adapter; `emailConfirmationConfig` owns only trusted-origin parsing. Domain files import neither infrastructure nor Node I/O.
- The architecture engine's `isDomainContract` allowlist already explicitly recognizes every file under `backend/src/domain/entities`, `ports`, and `exceptions`; its focused suite passed, so no boundary-test change was warranted.
- Production source line counts are all below 250: `NormalizedEmail` 7, `EmailConfirmationToken` 41, exception 7, individual ports 3–4, crypto generator 8, SHA-256 adapter 8, origin config 47, and architecture engine 79.

### TDD Cycle Evidence

| Task                       | RED                              | GREEN                            | TRIANGULATE                     | REFACTOR                                                                                                                          |
| -------------------------- | -------------------------------- | -------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Domain/security primitives | Completed in prior bounded units | Completed in prior bounded units | Completed in prior bounded unit | Fresh architecture/domain/security regression passed; existing split has no structural defect, so no source extraction was added. |

### Verification evidence

- `pnpm --filter backend test -- --runInBand backend/src/architecture backend/src/domain backend/src/infrastructure/security` — passed (14 suites, 132 tests).
- `git diff --check` — passed before and after the OpenSpec artifact updates.

### Files changed

- `openspec/changes/email-confirmation-vertical-slice/tasks.md`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Scope, workload, and next boundary

- Work-unit boundary: `domain-security-refactor`, stacked-to-main slice 1. No production or test source changed; no repository, issuance, confirmation, registration, SMTP, frontend, or E2E work began.
- Authored work-unit estimate: 53 changed lines (OpenSpec evidence plus one checkbox replacement), below the 400-line review budget. The existing worktree contains unrelated and prior-slice changes that were not modified.
- Deviation: none. A no-source-change proof is intentional because further splitting would create speculative abstractions and the existing architecture rule already recognizes the ports directory.
- Next persistence/repository RED task is ready: `- [ ] **RED — add repository/use-case tests** for lock-user-first replacement, invalidate-and-insert as one transaction, no mail before token commit, no token/mail on persistence failure, one active token under concurrent replacements, and post-commit mail failure retaining the usable token. Run \`pnpm --filter backend test:integration -- --runInBand backend/src/infrastructure/repositories\` plus focused application tests. <!-- sdd-owner: implementation -->`
- Remaining unchecked implementation tasks are the exact unchecked rows beginning with that persistence/repository RED task in `tasks.md`; parent lifecycle rows remain deferred and unchanged.

### Status consumed

- `applyState: ready`; `nextRecommended: apply`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`.
- Delivery path: resolved `stacked-to-main`; bounded work unit: `domain-security-refactor`; native review budget: 400 changed lines.
- No acquire, settle, commit, stage, reset, stash, push, or PR action occurred.

## Recovery note — cumulative progress reconciled

The previous cumulative progress artifact was accidentally replaced during the `smtp-red` delegated apply. The committed baseline was restored from `/tmp/email-confirmation-apply-progress-head.md` (byte-identical to the committed artifact), and the completed work below was reconciled from `tasks.md`, native SDD attempt history, and the prior session evidence. No implementation task was reverted; `tasks.md` remains the source of truth for 21/39 completed implementation rows.

### Reconciled completed slices

- Persistence migration/model work completed with real-MySQL migration, model, association, type, and internal entity evidence. Migration backfills historical users with one timestamp, keeps new users nullable/unverified, enforces digest-only token storage and one active slot, cascades user deletion, and removes token storage before the user column on down.
- Domain/security work completed with normalized email, 32-byte CSPRNG base64url tokens, lowercase SHA-256 digests, exact 24-hour expiry, trusted `PUBLIC_APP_URL` validation, stable record-id-only delivery keys, and no public DTO verification-state or secret leakage. Focused domain/security and architecture regressions passed through refactor.
- Repository/issuer work completed with user-first locking, transactional replacement, rollback safety, one active token, post-commit mail invocation, verified-user ineligibility, and sanitized post-commit mail failure handling. Real-MySQL race and rollback evidence passed.
- Confirmation work completed with bounded JSON POST validation, generic invalid responses, hash-before-lookup, atomic verify-and-consume, idempotent consumed+verified `204`, pre-validation IP limiting, and no GET mutation path. Controller, route, limiter, application, architecture, and repository regressions passed.
- Registration compatibility completed with post-create optional issuer invocation while preserving required multipart upload, existing `201` response shape, immediate session cookies, redirect, duplicate/create failure semantics, and unverified-user access. Registration triangulation passed without changing the controller/session/DTO contract.
- Resend RED completed with normalized lookup, absent/verified no-send behavior, account reservation boundaries, five accepted requests per trusted IP per rolling hour, three account sends per rolling hour, 60-second interval, reservation release/retention semantics, and identical generic `202` route expectations. The partial resend GREEN attempt added the core seams but left the route unmounted because the required `MailPort` composition was intentionally deferred; focused evidence was 16/17 with only the expected route `404`, and the broader route assertion was 514/515.
- The maintainer-approved architecture-first file-organization policy was applied to `AGENTS.md`, `PRODUCT.md`, backend/frontend quality tooling, CI, and architecture documentation: file length is diagnostic only, while cohesion, coupling, responsibility, dependency direction, testability, feature boundaries, security, accessibility, dead-code, and `console.log` checks remain active.

### Slice 3 — smtp-config-red

**Status:** completed RED-only dependency prerequisite. Production SMTP/configuration, adapter, composition, dependency installation, route mounting, OpenAPI implementation, and Mailpit service changes remain intentionally unimplemented.

- [x] **RED — add adapter/config tests** for required validated origin and SMTP environment parsing, fake Nodemailer transport submission, escaped Spanish template content, absolute trusted-origin URL, stable non-secret record-id key, and allowlisted sanitized SMTP failures; add OpenAPI tests for body contracts, `204`, generic `400`, and the identical generic `202` contract for every syntactically valid resend request, including limited requests. <!-- sdd-owner: implementation -->

#### TDD Cycle Evidence

- Safety baseline: config/OpenAPI tests passed with 2 suites and 51 tests before the RED additions.
- RED: the focused config/mail/OpenAPI command failed as intended with 4 failed suites and 10 failed tests; the failures identify missing mail adapter/template modules, absent SMTP parsing, and missing confirmation/resend OpenAPI paths/contracts.
- Formatting and `git diff --check` passed after formatting only the four SMTP RED test files.

#### Files changed

- `backend/src/infrastructure/config/__tests__/emailConfirmationConfig.test.ts`
- `backend/src/infrastructure/mail/__tests__/NodemailerSmtpMailAdapter.test.ts`
- `backend/src/infrastructure/mail/__tests__/emailConfirmationTemplate.test.ts`
- `backend/src/infrastructure/openapi/__tests__/openapiSpec.test.ts`
- `openspec/changes/email-confirmation-vertical-slice/tasks.md`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

#### Scope, workload, and next boundary

- This dependency-safe RED slice stays within the 400-line review budget and does not claim SMTP delivery, inbox delivery, or production-provider support.
- The tests require `PUBLIC_APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional `SMTP_USER`/`SMTP_PASS`, and `SMTP_FROM`; they require a provider-neutral injected transport seam, escaped Spanish content, and record-id-only idempotency with sanitized `smtp_failed` outcomes.
- The OpenAPI RED contract requires JSON `{ token }` with `204`/generic `400`, and JSON `{ email }` with the identical generic `202` response for absent, verified, eligible, and limited syntactically valid resend requests.
- Next boundary: implement SMTP GREEN and compose the MailPort before mounting resend; keep route composition and OpenAPI implementation in the same dependency-safe backend slice only if the changed-line budget remains honest.

### Recovery status consumed

- `applyState: ready`; `nextRecommended: sdd-apply`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`; delivery path: `stacked-to-main`; strict TDD active.
- The `smtp-red` native attempt remains active in the parent ledger and must be settled only after the restored cumulative artifact and current RED evidence are verified. No commit, push, pull, or remote mutation occurred.

## Slice 4 — focused E2E RED

**Status:** completed RED-only contract slice. No production behavior, access gate, provider, queue, outbox, or worker was added.

### Completed task and persisted checkbox update

- [x] **RED — create focused Playwright scenarios and test setup** that start/use Mailpit with raised-but-enabled test limiter settings: register with required image, verify browser cookies/authentication and unchanged redirect, retrieve the accepted local SMTP message through Mailpit’s test-only API, open its GET link and prove database state remains unverified/unconsumed, submit confirmation, and assert verified/consumed state. Add unverified login/account/cart/checkout regression cases. <!-- sdd-owner: implementation -->

### TDD Cycle Evidence

| Task                           | Test files                                                                  | Layer                              | Safety net                                                           | RED                                                                                                                                    | GREEN                                   | TRIANGULATE                             | REFACTOR                                            |
| ------------------------------ | --------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| Focused email confirmation E2E | `e2e/tests/email-confirmation.spec.ts`, `e2e/fixtures/emailConfirmation.ts` | Playwright + real local DB/Mailpit | Existing root wrapper exposed an inherited web-server startup issue. | Two scenario contracts were added first; focused execution failed before browser flow because `http://localhost:4322` was unavailable. | Deferred by assigned RED-only boundary. | Deferred by assigned RED-only boundary. | Deferred to the assigned Mailpit helper/reset task. |

### RED evidence

- `pnpm test:e2e -- --grep "email confirmation"` was attempted before the new contracts. The wrapper passed a literal `--` to Playwright, so grep was not applied and the inherited full suite exceeded the 120-second execution bound. Backend startup also reported the existing `ERR_ERL_KEY_GEN_IPV6` validation error from `resendConfirmationIpLimiter.ts`.
- `pnpm --filter e2e test --project=chromium --grep "email confirmation"` ran the two scenarios and started `docker compose up -d mailpit`; both failed in RED before registration because the frontend test server was unavailable (`page.goto('/register')` timed out, then `ERR_CONNECTION_REFUSED`).

### Files changed

- `e2e/tests/email-confirmation.spec.ts`
- `e2e/fixtures/emailConfirmation.ts`
- `e2e/playwright.config.ts`
- `e2e/global-setup.ts`
- `openspec/changes/email-confirmation-vertical-slice/tasks.md`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Scope, workload, and remaining tasks

- The tests require the existing profile image, preserve the registration redirect and cookie auth, distinguish Mailpit local transport acceptance from inbox/production delivery, inspect real verification/token state around GET and explicit POST, and cover unverified login, account-menu, cart, and checkout behavior.
- `global-setup.ts` starts Compose Mailpit. Playwright receives raised test limiter environment values without disabling limits; current confirmation/resend limiters do not yet consume those names, which is a GREEN composition gap.
- Authored work is approximately 240 changed lines, below the 400-line budget. No product behavior was established because test servers did not become available.
- Remaining tasks: GREEN, TRIANGULATE, REFACTOR, and final quality-gate rows in section 9 remain visibly unchecked.

### Status consumed

- `applyState: ready`; `artifactStore: openspec`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`; no warnings.
- Delivery path: four-slice `stacked-to-main`; section 9 RED; review budget: 400; no size exception.
- Parent owns native attempt `sha256:9f08d797010815229142b1cc27ecc767e8dac8cdb24b24fd8f6fc67a9f92b424`; no acquisition, settlement, commit, push, or child-agent action occurred.

## Slice 4 — focused E2E TRIANGULATE (blocked by diagnostics)

**Status:** blocked before focused execution. The existing two-scenario focused E2E safety net had passed (2/2) before new browser/privacy/failure cases were authored. The new test-only cases cover invalid-token generic feedback, repeated idempotent confirmation, absent/verified/IP-limited generic resend acceptance, and an SMTP-stop `try/finally` registration-state path. No production source was changed.

### Blocker

- The automatic diagnostic after the test-only edit reported `opengrep silent — diagnostics are incomplete` and identified `e2e/playwright-report/` as an untracked generated target. That report directory is outside the parent-provided allowed edit surfaces, so it was not modified or removed. Per the diagnostic instruction, no focused test, `git diff --check`, checkbox update, or final gate was run after this blocker.

### TDD Cycle Evidence

| Task                    | Test files                                                                  | Layer                            | Safety net                                    | RED                           | GREEN                                              | TRIANGULATE                                                         | REFACTOR                               |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------- | ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| Focused E2E TRIANGULATE | `e2e/tests/email-confirmation.spec.ts`, `e2e/fixtures/emailConfirmation.ts` | Playwright + local MySQL/Mailpit | Focused direct Playwright command passed: 2/2 | New behavioral cases authored | Blocked before execution by incomplete diagnostics | Cases target invalid, repeat, privacy-limit, and SMTP-failure paths | Deferred to the assigned REFACTOR task |

### Files changed

- `e2e/tests/email-confirmation.spec.ts`
- `e2e/fixtures/emailConfirmation.ts`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Persisted task state and workload

- The section 9 TRIANGULATE checkbox remains `[ ]`; REFACTOR and final quality-gate rows remain `[ ]`.
- No checkbox update was made because the newly authored focused cases have not passed.
- The bounded test-only source changes plus this progress entry require final line-count review after diagnostics are resolved; no size exception is requested.

### Status consumed

- `applyState: ready`; `artifactStore: openspec`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`.
- Delivery path: `stacked-to-main`, slice 4, 400-line review budget; the parent retains native attempt token `sha256:79bfc8eeb0b7500248f036979e7bdb5ceeb42bd12dd379b951bed146e874ff9c`.
- No acquire, settlement, commit, push, or child-agent action occurred.

## Slice 4 — focused E2E TRIANGULATE reconciliation

**Status:** completed. This entry supersedes the preceding diagnostics-only blocked-before-execution note; that earlier note remains historical context.

### Completed task and persisted checkbox update

- [x] **TRIANGULATE — add browser/privacy/failure cases** for invalid link token generic UI, repeated successful submit, resend no-enumeration with generic `202` for limited cases, and unavailable SMTP retaining registration/session/token. <!-- sdd-owner: implementation -->

### Parent verification evidence

- `pnpm --filter e2e exec playwright test --project=chromium --grep "email confirmation|unverified" --reporter=list` — passed (6/6).
- Coverage includes generic invalid-link UI without token rendering; repeated successful confirmation; absent, verified, and IP-limited resend requests with the same generic `202`; and unavailable SMTP retaining registration, session, and active token state.
- The SMTP-stop test restored Mailpit in its `finally` block. `git diff --check` passed.
- This reconciliation made no production-source changes. Mailpit evidence remains local SMTP adapter acceptance only; it does not claim inbox delivery, a production provider, or an access gate.

### Scope, workload, and remaining tasks

- Work-unit boundary: `focused-e2e-triangulate`, slice 4 of the `stacked-to-main` chain. This reconciliation changes only the task checkbox and progress evidence, well below the 400-line budget.
- `e2e/playwright-report/**` is an inherited generated artifact and was treated as read-only; no report output was modified.
- The section 9 REFACTOR and final quality-gate rows remain unchecked.

### Status consumed

- `applyState: ready`; `artifactStore: openspec`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`; no warnings.
- Parent retains native attempt token `sha256:79bfc8eeb0b7500248f036979e7bdb5ceeb42bd12dd379b951bed146e874ff9c`; no acquire, settlement, commit, push, or child-agent action occurred.

## Slice 4 — focused E2E REFACTOR

**Status:** completed. Mailpit operations and confirmation-state reads now live in test-only fixture helpers, while the focused suite resets its database, Mailpit messages, and in-memory limiter process on every run.

### Completed task and persisted checkbox update

- [x] **REFACTOR — isolate Mailpit test-only API helpers and reset limiter/database state reliably** so focused tests remain repeatable and do not weaken existing auth/cart/checkout coverage. <!-- sdd-owner: implementation -->

### TDD Cycle Evidence

| Task                    | Test file                              | Layer          | Safety net                              | RED                                                                                                                                | GREEN                                                                                     | TRIANGULATE                                                                                                            | REFACTOR                                                                                                                                  |
| ----------------------- | -------------------------------------- | -------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Focused E2E composition | `e2e/tests/email-confirmation.spec.ts` | Playwright E2E | 6/6 focused tests passed before editing | The outage scenario imported the missing `withMailpitUnavailable` test helper; focused execution failed at module load as expected | Added the helper with `try/finally` restoration and Mailpit readiness polling; 6/6 passed | A second fresh focused run passed 6/6 after database reset, global Mailpit clear, and fresh backend/frontend processes | Replaced direct test-level Compose calls with test-only helper ownership; confirmation DB reads now share one fixture-local record lookup |

### Verification evidence

- `pnpm --filter e2e exec playwright test --project=chromium --grep "email confirmation|unverified" --reporter=list` — RED failed as expected because `withMailpitUnavailable` was not exported.
- Same focused command — passed twice (6/6, 28.4s and 30.5s), proving the reset seam across consecutive runs.
- `git diff --check` — passed after the completed refactor.

### Files changed

- `e2e/tests/email-confirmation.spec.ts`
- `e2e/fixtures/emailConfirmation.ts`
- `e2e/global-setup.ts`
- `e2e/playwright.config.ts`
- `openspec/changes/email-confirmation-vertical-slice/tasks.md`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Scope, workload, and remaining tasks

- Work-unit boundary: `focused-e2e-refactor`, PR 4 of the resolved `stacked-to-main` chain. The focused tests retain their six confirmation/unverified scenarios, including the pre-existing auth, cart, and checkout assertions.
- `global-setup.ts` starts and health-checks Mailpit, recreates the test database, and clears Mailpit messages; each focused test clears Mailpit independently. Both Playwright web servers use fresh processes, preventing prior in-memory limiter state from being reused.
- The Mailpit outage scenario delegates stop/start and readiness restoration to `withMailpitUnavailable`; direct `execSync` calls no longer exist in the test. This remains test-only local SMTP acceptance evidence, not inbox delivery, a production provider, or an access gate.
- This bounded refactor adds approximately 130 authored source and OpenSpec lines, below the 400-line review budget. No production behavior, policy, provider scope, queue/outbox/worker, or user-facing assertion changed.
- Remaining implementation task: `- [ ] **Run final quality gates and record evidence**: \`pnpm test:fast\`, \`pnpm test:integration\`, \`pnpm --filter frontend check\`, \`pnpm --filter frontend build\`, backend OpenAPI/architecture checks, \`pnpm test:e2e\`, and \`pnpm test:all\`; report any coverage risk-map gaps honestly and confirm no production-delivery/access-gate claims. <!-- sdd-owner: implementation -->`

### Status consumed

- `applyState: ready`; `artifactStore: openspec`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`; no warnings.
- Parent owns native attempt token `sha256:c78c0addfde8f09a0f670029d5c5e9df08b06bddefe10efcee145c59bd17fc0d`; no acquisition, settlement, commit, push, or child-agent action occurred.

## Slice 4 — final quality gates (blocked)

**Status:** blocked at the first mandatory gate. Per the final-gate contract, no later command was run, no production behavior was changed, and the final quality-gate task remains unchecked.

### Exact verification evidence

- `pnpm test:fast` — **failed** (exit 1) before the frontend test leg ran: backend Jest reported 1 failed / 141 passed suites and 3 failed / 1,128 passed tests (1,131 total). `backend/src/__tests__/appConfig.test.js` expects startup not to throw when `SESSION_SECRET`, `COOKIE_SECRET`, or non-production `CORS_ORIGIN` is missing, but importing `backend/src/app.js` now throws `Error: PUBLIC_APP_URL is required` from `parsePublicOrigin` in `backend/src/infrastructure/config/emailConfirmationConfig.ts:24`, composed through `backend/src/infrastructure/routes/api/users.ts:62` and `routes/api/index.ts:3`.
- The test runner additionally reported that a worker was force-exited because of likely teardown leakage. This was recorded but not investigated because the startup expectation failure already blocks the gate.
- Not run after the failure: `pnpm test:integration`, `PUBLIC_API_URL=http://localhost:3031 pnpm --filter frontend check`, `PUBLIC_API_URL=http://localhost:3031 pnpm --filter frontend build`, `pnpm --filter backend check:openapi`, `pnpm --filter backend architecture:check`, `pnpm test:e2e`, and `pnpm test:all`.

### Persisted task status

- [ ] **Run final quality gates and record evidence**: `pnpm test:fast`, `pnpm test:integration`, `pnpm --filter frontend check`, `pnpm --filter frontend build`, backend OpenAPI/architecture checks, `pnpm test:e2e`, and `pnpm test:all`; report any coverage risk-map gaps honestly and confirm no production-delivery/access-gate claims. <!-- sdd-owner: implementation -->

### Scope, risks, and status consumed

- No coverage risk-map conclusion is available because the required final sequence stopped at its first command. The local Mailpit transport was healthy at `localhost:8025`, but it was not exercised in this failed sequence; it remains local transport acceptance only, not inbox or production delivery evidence.
- No production-delivery claim or verification-based login, cart, account, checkout, role, or other access-gate claim is made.
- Only this cumulative OpenSpec evidence was changed (well below the 400-line work-unit budget); inherited Playwright report artifacts were preserved untouched.
- Consumed status: `applyState: ready`; `artifactStore: openspec`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`; no warnings. Parent owns the active native token supplied for this phase; no attempt acquisition, settlement, commit, push, or child-agent action occurred.

## Slice 4 — final-gate startup remediation

**Status:** remediation complete; the final quality-gate task remains unchecked pending the parent’s full-gate rerun.

### Remediation and TDD evidence

| Task                                      | Test file                                 | Layer               | Safety net                                                 | RED                                                                                                                                              | GREEN                                                                                  | TRIANGULATE                                                                                                                                                      | REFACTOR                                                                                         |
| ----------------------------------------- | ----------------------------------------- | ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Non-production email composition defaults | `backend/src/__tests__/appConfig.test.js` | Startup integration | Existing narrow suite exposed 3 failing startup assertions | The requested narrow command failed: missing email configuration threw `PUBLIC_APP_URL is required` for the three development-mode startup cases | The same narrow command passed 5/5 after the composition-only default selection change | The existing independent missing `SESSION_SECRET`, `COOKIE_SECRET`, and non-production `CORS_ORIGIN` cases exercised three distinct development startup contexts | No further refactor was needed; configuration parsing and the real SMTP adapter remain unchanged |

### Verification evidence

- `pnpm --filter backend test -- --runInBand backend/src/__tests__/appConfig.test.js` — RED failed as expected: 3 failed and 2 passed tests; route composition required `PUBLIC_APP_URL` before those startup cases could isolate their JWT/CORS requirements.
- Same narrow command — GREEN passed (1 suite, 5 tests).
- `pnpm --filter backend type-check` — passed.
- `pnpm --filter backend architecture:check` — passed.
- `pnpm --filter backend check:openapi` — failed because `backend/openapi.json` is stale; regeneration was not performed because that generated file is outside this remediation’s allowed edit surfaces.
- `git diff --check` — passed.

### Scope, workload, and remaining task

- `backend/src/infrastructure/routes/api/users.ts` now supplies the safe localhost/Mailpit values only when `NODE_ENV` is not `production` and none of the email configuration variables are supplied. It still composes the real Nodemailer SMTP adapter; it does not introduce a no-op adapter.
- Any supplied email setting remains validated by `loadEmailConfirmationConfig`, and `NODE_ENV=production` never receives defaults, preserving strict `PUBLIC_APP_URL` and SMTP validation. Existing E2E values (`PUBLIC_APP_URL=http://localhost:4322` and Mailpit SMTP) override nothing because they are explicit configuration.
- No focused assertion was added: the three existing development startup cases already provided the concrete RED regression and independent contexts needed for this narrow composition fix.
- Work-unit diff is within the 400-line budget; no task checkbox changed. The final quality-gate row remains: `- [ ] **Run final quality gates and record evidence**: \`pnpm test:fast\`, \`pnpm test:integration\`, \`pnpm --filter frontend check\`, \`pnpm --filter frontend build\`, backend OpenAPI/architecture checks, \`pnpm test:e2e\`, and \`pnpm test:all\`; report any coverage risk-map gaps honestly and confirm no production-delivery/access-gate claims. <!-- sdd-owner: implementation -->`
- No coverage risk-map conclusion is available from this bounded remediation. It makes no production-delivery, inbox-delivery, production-provider, queue/outbox/worker, or verification-based access-gate claim.

### Status consumed

- `applyState: ready`; `artifactStore: openspec`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`; no warnings.
- Parent owns active native token `sha256:52db4cc9946c5307b552462408c6d26791e3370104cdb3e70eec31404b98e97c` and will settle it with remediation revision `sha256:e9a68771329392a4abc0c00589ea7f5d0da9cfb9e9d3291c82bcae4d81c6e2be`; no acquisition, settlement, commit, push, or child-agent action occurred.

## Slice 4 — final-gate rerun after OpenAPI regeneration

**Status:** blocked at `pnpm test:integration`; the final quality-gate task remains unchecked. This is current evidence from the parent-held attempt, independent of the prior failed final-gate evidence.

### Exact verification evidence

- `pnpm --filter backend generate:openapi` — passed; regenerated committed `backend/openapi.json` from current route annotations.
- `pnpm --filter backend check:openapi` — passed after regeneration (`JSON clean`, 8875ms).
- `pnpm test:fast` — passed: backend Jest 142 suites / 1,131 tests; frontend Vitest 27 files / 344 tests. Jest also emitted a non-failing warning that one worker was force-exited after likely teardown leakage.
- `pnpm test:integration` — failed: 2 suites / 3 tests failed; 9 suites / 54 tests passed. `backend/src/__tests__/deploy-migrate-and-start.integration.test.js` could not create its setup connection because MySQL rejected `root@localhost` with `Access denied for user 'root'@'localhost'`. `backend/src/infrastructure/repositories/__tests__/SequelizeEmailConfirmationTokenRepository.integration.test.ts` observed both concurrent direct inserts succeed where its active-slot backstop assertion expected one fulfilled and one rejected (`Expected length: 1`, `Received length: 2`). The runner also emitted the existing `ts-jest` `isolatedModules` deprecation warning.
- Not run after the integration failure: `PUBLIC_API_URL=http://localhost:3031 pnpm --filter frontend check`, `PUBLIC_API_URL=http://localhost:3031 pnpm --filter frontend build`, the rerun of `pnpm --filter backend check:openapi`, `pnpm --filter backend architecture:check`, `pnpm test:e2e`, and `pnpm test:all`.

### Persisted task status and constraints

- The final implementation row remains unchecked: `- [ ] **Run final quality gates and record evidence**: \`pnpm test:fast\`, \`pnpm test:integration\`, \`pnpm --filter frontend check\`, \`pnpm --filter frontend build\`, backend OpenAPI/architecture checks, \`pnpm test:e2e\`, and \`pnpm test:all\`; report any coverage risk-map gaps honestly and confirm no production-delivery/access-gate claims. <!-- sdd-owner: implementation -->`
- No coverage risk-map conclusion is available because the required sequence stopped at integration. The local Mailpit slice remains transport acceptance only; this evidence makes no inbox, production-delivery, provider, queue/outbox/worker, or verification-based access-gate claim.
- Only `backend/openapi.json` and this cumulative progress artifact were modified in this rerun; inherited `e2e/playwright-report/**` remains untouched. No acquire, settle, commit, push, or child-agent action occurred.
- Consumed status: `applyState: ready`; `artifactStore: openspec`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`; no warnings. Parent holds active token `sha256:ef8b8945b3546d7d3b401385fb67fa7a2a83b6ff5107c71a60080752cd49f690`.

## Slice 4 — final-gate integration remediation

**Status:** bounded remediation completed; the final quality-gate task remains unchecked because the complete integration suite is still blocked by unrelated startup configuration and scratch-database parallelism failures.

### Remediation and TDD evidence

| Task                                | Test file                                                                                                         | Layer                  | Safety net                                                 | RED                                                                                                                     | GREEN                                                                                             | TRIANGULATE                                                                                            | REFACTOR                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Sequelize active-slot schema mirror | `backend/src/infrastructure/repositories/__tests__/SequelizeEmailConfirmationTokenRepository.integration.test.ts` | Real MySQL integration | The focused test ran with `backend/.env` exported silently | The direct concurrent inserts both succeeded (2 fulfilled), proving `sync({ force: false })` lacked the composite index | After adding the named model index, the focused test passed (4/4) with one direct insert rejected | Existing replacement, rollback, direct-insert, and stale-confirm cases cover distinct real-MySQL paths | No refactor needed; the named model index follows the existing database-field convention |

### Verification evidence

- `set -a; . backend/.env; set +a; pnpm --filter backend test:integration -- --runInBand` — the package script forwarded a literal `--` to Jest, which treated `--runInBand` as a test-path pattern and found no tests. No credentials were printed.
- `set -a; . backend/.env; set +a; pnpm --filter backend exec jest --config jest.integration.config.js --runInBand src/infrastructure/repositories/__tests__/SequelizeEmailConfirmationTokenRepository.integration.test.ts` — RED failed with 2 fulfilled direct inserts, then GREEN passed (1 suite, 4 tests) after the model correction. The loaded package-local database settings eliminated the former `root@localhost` authentication failure for this suite.
- `set -a; . backend/.env; set +a; pnpm --filter backend test:integration` — failed: 2 suites / 3 tests failed and 9 suites / 54 tests passed. The deploy-migrate-and-start child process now fails because it lacks `PUBLIC_APP_URL`; the shared `mundo_3d_migrate_scratch` migration suite then fails due to parallel interference. Neither failure is a database-credential or active-slot-index failure, and neither was changed in this bounded remediation.
- `pnpm --filter backend type-check` — passed.
- `pnpm --filter backend architecture:check` — passed.
- `pnpm --filter backend check:openapi` — failed because the inherited `backend/openapi.json` is stale; it was preserved because it is outside this remediation's allowed edit surfaces.
- `git diff --check` — passed before this evidence update.

### Scope, remaining task, and constraints

- Added `uq_email_confirmation_token_user_active_slot` to the `EmailConfirmationToken` Sequelize model with database field names `id_user` and `active_slot`; it preserves nullable-slot semantics, so multiple historical `NULL` slots remain legal.
- No database configuration file was changed: shell-exporting `backend/.env` supplied the local configured database connection without exposing its password and retained explicit `DB_*` environment overrides.
- The final implementation row remains unchecked: `- [ ] **Run final quality gates and record evidence**: \`pnpm test:fast\`, \`pnpm test:integration\`, \`pnpm --filter frontend check\`, \`pnpm --filter frontend build\`, backend OpenAPI/architecture checks, \`pnpm test:e2e\`, and \`pnpm test:all\`; report any coverage risk-map gaps honestly and confirm no production-delivery/access-gate claims. <!-- sdd-owner: implementation -->`
- No coverage risk-map conclusion is available. Mailpit remains local transport acceptance only; no inbox, production-delivery, provider, queue/outbox/worker, or verification-based access-gate claim is made.
- This remediation adds 8 production lines plus this evidence, well below the 400-line review budget. No task checkbox, attempt acquisition, settlement, commit, push, or generated Playwright report was changed.

### Status consumed

- `applyState: ready`; `artifactStore: openspec`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`; no warnings.
- Parent owns active native token `sha256:4dc1d8ff8ad75c29c330323df9ef59a5dfcbd75617aa34b79f1b88b6aed4a183` and owns settlement; no acquisition or settlement was performed.

## Slice 4 — deploy integration harness remediation

**Status:** completed bounded test-harness remediation. The final quality-gate task remains unchecked for the parent’s full ordered gate sequence.

### TDD Cycle Evidence

| Task                                                  | Test file                                                            | Layer                          | RED                                                                                                                                              | GREEN                                                                                                                                | TRIANGULATE                                                                                                   | REFACTOR                                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Production deploy harness configuration and isolation | `backend/src/__tests__/deploy-migrate-and-start.integration.test.js` | Real MySQL/process integration | Full suite failed: deploy child failed closed on missing `PUBLIC_APP_URL`, while the migration suite also collided on `mundo_3d_migrate_scratch` | Added explicit non-secret Mailpit configuration and a dedicated deploy scratch database; full suite passed 11/11 suites, 57/57 tests | The full concurrent suite proved both the production child boot and migration CLI suite operate independently | Kept the change confined to the test environment object; production validation and composition remain unchanged |

### Verification evidence

- `cd backend && set -a && . ./.env && set +a && pnpm test:integration` — RED failed (2 suites / 3 tests): the deploy boot child lacked `PUBLIC_APP_URL`, and the fixed migration scratch database conflicted with the migration CLI suite. No credentials were printed.
- Same command — GREEN passed: 11 suites / 57 tests. MariaDB was reachable through the package-local environment; the only runner output was the existing non-failing `ts-jest` `isolatedModules` deprecation warning.
- `pnpm --filter backend type-check` — passed.
- `pnpm --filter backend architecture:check` — passed.
- `git diff --check` — passed.

### Files changed

- `backend/src/__tests__/deploy-migrate-and-start.integration.test.js`
- `openspec/changes/email-confirmation-vertical-slice/apply-progress.md`

### Scope, remaining task, and constraints

- The production-mode spawned child now receives explicit test-only `PUBLIC_APP_URL=http://localhost:4321` plus non-secret Mailpit-compatible `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, and `SMTP_FROM` values. No credentials or provider settings were added.
- The deploy suite uses `mundo_3d_deploy_scratch`; `backend/src/database/__tests__/migrate.integration.test.js` remains unchanged on `mundo_3d_migrate_scratch`, avoiding concurrent schema lifecycle interference.
- Production configuration validation and application composition were not changed. The 19-line source diff and this evidence remain within the 400-line budget.
- The final implementation row remains unchecked: `- [ ] **Run final quality gates and record evidence**: \`pnpm test:fast\`, \`pnpm test:integration\`, \`pnpm --filter frontend check\`, \`pnpm --filter frontend build\`, backend OpenAPI/architecture checks, \`pnpm test:e2e\`, and \`pnpm test:all\`; report any coverage risk-map gaps honestly and confirm no production-delivery/access-gate claims. <!-- sdd-owner: implementation -->`
- This remediation makes no local-inbox, production-delivery, provider, queue/outbox/worker, or verification access-gate claim. Coverage risk-map assessment remains pending the parent’s final full sequence.

### Status consumed

- `applyState: ready`; `artifactStore: openspec`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`; no warnings.
- Parent owns active native token `sha256:dcdf0dc17cd3e8eb5c8026a7b4ecfa9847246e287e6654d9ab0b851b1d4d2024` and its settlement; no attempt acquisition, settlement, commit, push, or child-agent action occurred.

## Slice 5 — final quality gates passed

**Status:** completed from independently verified final-gate evidence. The final implementation-owned quality-gate checkbox is now `[x]`; parent lifecycle rows remain unchanged and pending verification, sync, and archive.

### Ordered verification evidence

1. `pnpm test:fast` — passed: backend 142/142 suites and 1,131/1,131 tests; frontend 27/27 files and 344/344 tests.
2. `cd backend && set -a && . ./.env && set +a && pnpm test:integration` — passed: 11/11 suites and 57/57 tests; no password was printed.
3. `PUBLIC_API_URL=http://localhost:3031 pnpm --filter frontend check` — passed: 97 files with 0 errors, warnings, or hints.
4. `PUBLIC_API_URL=http://localhost:3031 pnpm --filter frontend build` — passed: 18 pages.
5. `pnpm --filter backend check:openapi` — passed.
6. `pnpm --filter backend architecture:check` — passed.
7. `pnpm --filter e2e exec playwright test --project=chromium --reporter=list --output=/tmp/mundo3d-final-e2e` — passed: 128/128.
8. `pnpm test` — passed: backend 142/142 suites and 1,131/1,131 tests; frontend 27/27 files and 344/344 tests.
9. `pnpm --filter e2e exec playwright test --reporter=list --output=/tmp/mundo3d-final-e2e-all` — passed: 128/128. This directly ran the all-project E2E portion of `test:all` with a list reporter and external output directory, so inherited `e2e/playwright-report/**` was not modified.
10. `git diff --check` — passed.

### Warnings, limits, and lifecycle

- Non-failing warnings were the `ts-jest` `isolatedModules` deprecation, a backend test-worker forced-exit warning, and expected negative-path browser errors. The Mailpit stop/restart scenario restored Mailpit; none caused a failure.
- A prior mutation guard referenced nonexistent `backend/src/domains/models/models.service.spec.ts`; the parent confirmed that path does not exist and no repository mutation occurred. This is a tooling note only, not a source change.
- No final coverage risk-map run or gap-closure evidence was supplied, so this record makes no claim that coverage risk-map gaps are closed.
- Local Mailpit proves SMTP transport acceptance only. This record makes no claim of inbox delivery, production-provider delivery, queue/outbox/worker behavior, or verification-based access gating.
- Workload boundary: final evidence for stacked-to-main PR 4; this update changes only OpenSpec task/progress artifacts and remains below the 400-line review budget.
    
## Strict-TDD lineage reconciliation
    
**Status:** completed. This addendum restores the task-level cycle records that were summarized, but not retained as individual tables, after the cumulative artifact replacement. It does not add implementation claims beyond the checked rows in `tasks.md`; it makes the historical RED, GREEN, TRIANGULATE, REFACTOR, safety-net, test-file, and boundary evidence explicit for all 37 implementation tasks.
    
A phase described as inherited means that the phase was completed in the immediately preceding bounded work unit and is intentionally referenced rather than re-run. A no-source-change refactor records the structural inspection and regression gate that justified not extracting or rewriting code. Historical blocked attempts remain in the preceding sections; their later resolution is recorded here in the corresponding completed row.
    
| # | Implementation task | Test files and safety net | RED | GREEN | TRIANGULATE | REFACTOR |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Migration real-MySQL RED | `migrate.integration.test.js`; database safety net 4/7 | Added missing runner/schema assertions; expected pre-implementation failure | `bulkUpdate` backfill correction; focused runner 8/8 | Captured timestamp, nullable new users, duplicate active rejection, null slots, cascade, ordered down | Query-interface DDL remains statement-attributed |
| 2 | Additive migration and Sequelize mappings | User/token/index/domain tests; focused 4 suites/22 and integration 1/8 | Missing token model and mapping assertions failed | Migration/model/registry/entity mappings passed 4 suites/22 | Full model/domain focus 10 suites/30 plus real MySQL 1/8 | Internal mapping stayed separate from DTOs; production files remained cohesive |
| 3 | Persistence adversarial triangulation | `migrate.integration.test.js`; integration 8/8 and database 17 suites/58 | Inherited migration RED | Inherited mapping GREEN | Two historical null slots, duplicate active slot, cascade, and dependency-safe down passed | No source change; existing proof was sufficient |
| 4 | Persistence mapping refactor | Database/model/domain regression; 18 suites/75 | No new defect found in bounded refactor | Existing mappings remained green | Existing nullable, digest-only, association, and entity-state assertions passed | Line-count and DTO-boundary inspection passed; no speculative extraction |
| 5 | Domain/security RED contracts | Normalization/token/CSPRNG/config/registration tests; baseline 10 suites/81 | Missing normalization, generator, config, and pending-token seams failed as expected | Deferred to RED-only unit | Input normalization, token shape, origin, expiry, DTO, and idempotency cases were written first | No production code changed |
| 6 | Domain/security primitives | Same focused domain/security files; 14 suites/94 after correction | Inherited RED | Initial SHA-256 vector failed; corrected to the standard digest and reran 14 suites/94 successfully | Deferred to next task | Adapter/domain responsibilities remained separate |
| 7 | Domain/security adversarial cases | Token/config/registration tests; 14 suites/94 baseline | Inherited RED | Inherited GREEN | Encoded tokens, malformed origins, leap-day expiry, secret-safe state, and DTO boundaries passed at 14 suites/100 | No source change warranted |
| 8 | Domain/security responsibility refactor | Architecture/domain/security regression; 14 suites/132 | Inherited RED | Inherited GREEN | Inherited adversarial evidence | Fresh architecture and import-boundary proof passed; each port/adapter retained one responsibility |
| 9 | Repository/issuer RED contracts | Repository integration and issuer unit tests; safety net repository 6/35 | Missing repository and issuer modules failed as expected | Deferred to RED-only unit | Replacement, race, rollback, ordering, and mail-failure scenarios were written first | No production code changed |
| 10 | Transaction-aware repository and issuer | Same repository/issuer tests; focused issuer 1/2, repository 1/2, broad repository 6/34 | Inherited RED; initial real-MySQL seed was blocked by stale schema | Applied pending test migration; unit and real-MySQL GREEN passed | Deferred until seed/schema gate resolved | Repository, issuer, and opaque transaction responsibilities remained isolated |
| 11 | Repository race and rollback triangulation | Repository integration and issuer unit tests; focused 3/3 and 3/3 | Inherited RED | Inherited GREEN | Replacement race, rollback, unique-index backstop, no-mail persistence failure, post-commit failure, and log redaction passed; broad repository 6/35 | No production change needed |
| 12 | Repository transaction/port refactor | Application/architecture regressions; 42 suites/218 | Inherited RED | Inherited GREEN | Inherited repository adversarial evidence | Static import and opaque-transaction inspection passed; no use-case edge or speculative fixture abstraction |
| 13 | Confirmation RED contracts | Confirmation unit/controller/route and repository tests; application 3/40 and repository 6/35 | Missing use case/controller/route/repository seam failures were expected | Deferred to RED-only unit | Invalid classes, idempotent retry, one winner, rollback, and locking-race cases were specified | No production code changed |
| 14 | Atomic confirmation and route GREEN | Confirmation unit/controller/route/limiter plus repository integration; focused 4/12 and repository 6/36 | Inherited confirmation RED | Hash-before-lookup, user-first lock, atomic consume, generic mapping, JSON route, and pre-validation limiter passed | Deferred to next task | Cookies/session code remained untouched; route composition stayed bounded |
| 15 | Confirmation privacy and method semantics | Controller/route/limiter tests; safety net 3 suites/6 | Inherited RED and GREEN | Inherited GREEN behavior remained green | Unknown, expired, superseded, limited, secret-bearing, and both GET non-mutation cases passed; broad focus 34/439 | No production source change needed |
| 16 | Confirmation structural refactor | Same regressions plus architecture; 34 suites/439 and architecture 1/43 | Inherited RED | Inherited GREEN | Inherited privacy evidence | Removed one non-semantic composition blank line; validation, limiter, controller, and repository seams remained isolated |
| 17 | Registration compatibility RED contracts | Registration application/controller/route; backend 43/43, frontend 334/334, duplicate race 1/1 | Issuer-call assertions failed because constructor ignored issuer | Deferred to RED-only unit | Multipart, cookies, exact 201, redirect, duplicate cleanup, access, persistence failure, and SMTP failure cases were added | No production code changed |
| 18 | Post-create registration issuer GREEN | Use-case, controller, route, real-MySQL, and frontend regressions; use case 1/9 and backend 3/46 | Inherited RED | Optional issuer runs only after create; issuance failures are swallowed; focused GREEN passed | Deferred to next task | Use case remained 68 lines and controller/session ownership stayed unchanged |
| 19 | Registration call-order/failure triangulation | Registration suites; 3/46 before and 3/47 after | Inherited RED | Inherited GREEN | `find → hash → create → issue`, duplicate/create short-circuits, token/SMTP failure privacy, DTO, multipart, cookies, and redirect boundaries passed | No production refactor needed |
| 20 | Registration middleware/session refactor | Application/controller/route regression; 58 suites/467 | Inherited RED | Inherited GREEN | Inherited registration boundary evidence | No source change; middleware ordering, session ownership, upload cleanup, and layer-specific fixtures were preserved |
| 21 | Resend/privacy RED contracts | Resend use-case, account/IP limiter, controller/route tests; safety net 3 suites/10 | Missing resend use case/account/IP limiter modules failed as expected | Deferred to RED-only unit | Absent/verified/eligible, 5/6 IP, 3/4 account, interval, reservation, retention, and generic-202 cases were specified | No production code changed |
| 22 | Resend lookup, reservations, IP limit, and generic-202 GREEN | Resend use-case/account/IP/route tests; initial focused 16/17, then composition 49/49 | Inherited RED; route remained 404 before real mail composition | Added normalized lookup, account reservations, trusted-IP limiter, and real issuer route composition; final route contract passed | Deferred to limiter triangulation | Account state stayed in the use case; middleware remained IP-only |
| 23 | Resend limiter/concurrency triangulation | Account limiter and backend focused regressions; limiter 4/4 and app/middleware/routes 70 suites/515 | Interleaved failure exposed oldest-versus-newest release defect | Releasing the oldest reservation preserved later attempted sends | Exact 3/4, 59/60 seconds, rolling-hour, 5/6 IP, generic response, and SMTP-retention boundaries passed | Single-process limitation documented; no distributed claim |
| 24 | Resend limiter/config refactor | Infrastructure regression; 64 suites/722 | Inherited RED | Inherited GREEN | Inherited boundary cases | Account lookup, clock/store state, configuration, and route composition remained decoupled |
| 25 | SMTP/config/OpenAPI RED contracts | Config/mail/template/OpenAPI tests; safety net 2 suites/51 | Four focused suites failed as expected for missing adapter/template/config/paths | Deferred to RED-only unit | Request/response, escaped template, origin, transport, idempotency, and generic resend cases were authored first | No production code changed |
| 26 | SMTP adapter/config and Mailpit GREEN | Config/mail tests and route/OpenAPI composition; config/mail 3 suites/21 and composition 49/49 | Inherited SMTP RED | Nodemailer adapter, validated config, template, environment placeholders, local Mailpit, and real route composition passed | Deferred to SMTP/API triangulation | Real adapter was composed; no no-op/provider/queue path was introduced |
| 27 | SMTP/OpenAPI outcome triangulation | Config/mail/OpenAPI/issuer regressions; 6 suites/71 | Inherited RED and GREEN | Local HTTP versus production HTTPS, optional credentials, invalid origins, sanitized transport failure, redacted logger data, and generic OpenAPI contracts passed | No behavior rewrite needed |
| 28 | SMTP/config/template/transport refactor | Infrastructure regression; 64 suites/722 and OpenAPI generation/check | Inherited RED | Inherited GREEN | Inherited outcome evidence | Composition root, config, template, and transport remained separate; Mailpit wording is transport acceptance only |
| 29 | Frontend confirmation RED contracts | `emailConfirmation.service.test.ts`, `EmailConfirmationForm.test.ts`, `confirm-email.test.ts`; existing frontend safety net 334 | Three production modules were absent; focused RED failed as expected | Deferred to RED-only unit | Explicit POST, no load mutation, ephemeral token, generic states, focus/live feedback, and resend contract were specified | No production code changed |
| 30 | Frontend neutral flow GREEN | Same three frontend tests; focused/full 27 suites/342 and check 97 files | Inherited RED | Neutral page, explicit confirmation/resend service, accessible feedback, focused CSS, and layout composition passed | Deferred to frontend triangulation | No token/storage/cookie/analytics/delivery state was rendered or retained |
| 31 | Frontend privacy and retry triangulation | Same frontend tests; full 27 suites/344, check clean, build 18 pages | Inherited RED | Inherited GREEN | Missing/invalid token, repeated submit, 400/202 equivalence, 5xx/network retry, focus, storage/cookie/analytics absence, and no enumeration passed | Deferred to frontend refactor |
| 32 | Frontend layout/service refactor | Frontend check/build and Impeccable detector; check clean and 18-page build | Inherited RED | Inherited GREEN | Inherited source-contract evidence | Existing auth tokens/layout conventions and bundled client script were retained; no inline backend-served script or speculative extraction |
| 33 | Focused E2E RED scenarios | `e2e/tests/email-confirmation.spec.ts`, `e2e/fixtures/emailConfirmation.ts`; existing E2E safety net retained | Two new scenarios failed before browser flow because the test server was unavailable | Deferred to E2E composition | Registration, accepted SMTP message, GET non-mutation, explicit POST, and unverified access cases were authored first | Deferred to fixture/reset refactor |
| 34 | Focused E2E composition GREEN | Same E2E files; focused browser execution later established the 6-case safety net | Inherited RED; startup blocker was resolved by the test composition recorded in later E2E evidence | Mailpit/database/server composition became executable; six focused scenarios passed in the subsequent browser run | Deferred to browser/privacy triangulation | Test-only Mailpit and database reset ownership was isolated from product code |
| 35 | Focused E2E browser/privacy/failure triangulation | Same E2E files; Chromium focused 6/6 | Inherited RED | Inherited E2E GREEN | Invalid UI, repeated submit, absent/verified/limited generic resend, SMTP outage restoration, registration/session/token retention, and unverified access passed | Deferred to E2E refactor |
| 36 | Focused E2E fixture/reset refactor | Same E2E files plus `global-setup.ts` and Playwright config; focused 6/6 twice | Helper import failure was reproduced before the helper existed | Added `withMailpitUnavailable`, readiness polling, DB/Mailpit clears, and fresh-process reset; 6/6 passed twice | Inherited six-case behavior evidence | Direct Compose calls moved into test-only helpers; inherited report tree stayed untouched |
| 37 | Final quality gates | Full backend/frontend, integration, check/build, OpenAPI/architecture, and Chromium/all-project E2E commands; all final gates green | Earlier startup/OpenAPI/integration failures remain recorded in prior sections | Final ordered sequence passed: backend 142 suites/1,131 tests, frontend 27/344, integration 11/57, check 97 files, build 18 pages, Chromium 128/128, all-project 128/128 | Coverage risk map honestly records 0 tier-0 and 11 other gaps; no claim that non-tier-0 gaps are closed | Evidence-only task; no production refactor was required |
    
### Ordered dependency-safe review boundaries
    
The four conceptual PR labels are retained, but the evidence shows that each label must be decomposed into smaller review units. The following ordered units are the parent’s review workload plan: dependencies flow left-to-right, every unit is below the 400 changed-line budget, and no `size:exception` is used. OpenSpec evidence is part of the unit that authored it; generated Playwright reports and tool-state files are excluded.
    
| Order | Conceptual slice | Bounded review unit | Authored change estimate |
| ---: | --- | --- | ---: |
| 1 | PR1 persistence/security | `migration-integration` | 323 |
| 2 | PR1 persistence/security | `persistence-model` | 262 |
| 3 | PR1 persistence/security | `persistence-triangulate` | 41 |
| 4 | PR1 persistence/security | `persistence-refactor` | 46 |
| 5 | PR1 persistence/security | `domain-security-red` | 185 |
| 6 | PR1 persistence/security | `domain-security-green` | 166 |
| 7 | PR1 persistence/security | `domain-security-triangulate` | 85 |
| 8 | PR1 persistence/security | `domain-security-refactor` | 53 |
| 9 | PR2 token/confirmation/registration | `repository-red` | 178 |
| 10 | PR2 token/confirmation/registration | `repository-green` | 175 |
| 11 | PR2 token/confirmation/registration | `repository-triangulate` | 218 |
| 12 | PR2 token/confirmation/registration | `repository-refactor` | 50 |
| 13 | PR2 token/confirmation/registration | `confirmation-red` | 282 |
| 14 | PR2 token/confirmation/registration | `confirmation-green` | 285 |
| 15 | PR2 token/confirmation/registration | `confirmation-triangulate` | 165 |
| 16 | PR2 token/confirmation/registration | `confirmation-refactor` | 2 |
| 17 | PR2 token/confirmation/registration | `registration-red` | 123 |
| 18 | PR2 token/confirmation/registration | `registration-green` | 75 |
| 19 | PR2 token/confirmation/registration | `registration-triangulate` | 104 |
| 20 | PR2 token/confirmation/registration | `registration-refactor` | 45 |
| 21 | PR3 resend/SMTP/API | `resend-red` | 290 |
| 22 | PR3 resend/SMTP/API | `resend-green` | 162 |
| 23 | PR3 resend/SMTP/API | `route-openapi-composition` | 128 |
| 24 | PR3 resend/SMTP/API | `resend-smtp-triangulate-refactor` | 92 |
| 25 | PR4 frontend/E2E/final | `frontend-red` | 114 |
| 26 | PR4 frontend/E2E/final | `frontend-green` | 190 |
| 27 | PR4 frontend/E2E/final | `frontend-triangulate` | 110 |
| 28 | PR4 frontend/E2E/final | `frontend-refactor` | 50 |
| 29 | PR4 frontend/E2E/final | `focused-e2e-red` | 240 |
| 30 | PR4 frontend/E2E/final | `focused-e2e-green` | 150 |
| 31 | PR4 frontend/E2E/final | `focused-e2e-triangulate` | 150 |
| 32 | PR4 frontend/E2E/final | `focused-e2e-refactor` | 130 |
| 33 | PR4 frontend/E2E/final | `final-quality-gates` | 120 |
    
Counts are the authored estimates recorded at each boundary, not a claim that the current ambient working tree is one reviewable diff. The parent must review or commit these units in this order; aggregate conceptual PRs are not reviewable as single diffs. The historical migration commit contains 615 lines when OpenSpec material is included, so it is not reused as a compliant review boundary; the dependency-safe unit list supersedes that historical commit boundary without rewriting history.
    
### Parent lifecycle completion evidence
    
- Final implementation evidence is complete for all four delta specs: 13 requirements and 38 scenarios pass, with no unresolved claim beyond local Mailpit SMTP transport acceptance.
- Review workload is explicitly decomposed into 33 dependency-safe units under 400 changed lines; no size exception is inferred. The four conceptual labels remain grouping labels only.
- Review scope is implementation plus active OpenSpec/design evidence. `e2e/playwright-report/**`, `.impeccable/**`, and `.gentle-ai-instance` tool-state artifacts are excluded and remain unmodified.
- The remaining parent action is native review authority collection and acknowledgement; it cannot be represented as a synthetic reviewer verdict in this artifact.

- Consumed status: `applyState: ready`; `artifactStore: openspec`; `actionContext.mode: repo-local`; allowed root: `/home/ginopc/Desarrollo/Mundo-3D`; no warnings. The parent owns final-gate attempt token `sha256:a0347dfd1ef2942e1881f1cdfa041d512997c0c858bbf5f10ad574c1d7cd9730`; no acquisition, settlement, commit, push, reset, or child-agent action occurred.
