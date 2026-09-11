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
