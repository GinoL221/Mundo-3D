# Archive Report: Concurrency Tests

**Change**: concurrency-tests  
**Status**: Complete and merged to `main`  
**Archived**: 2026-08-26  
**Observation IDs**: proposal, spec (concurrency-guarantees, user-auth), design, tasks, verify-report

## Executive Summary

Two independent concurrency behaviors were tested, documented, and partially fixed. PR #60 (test-only cart race) and PR #61 (registration race fix + integration test) were merged independently to `main` on 2026-08-26. Post-merge verification by the orchestrator confirmed: 667/667 unit tests, 12/12 integration tests, lint clean, type-check clean. All Phase 7 verification tasks are complete. One spec-authoring issue (untestable scenario) was corrected before close: folding the rate-limit documentation requirement from executable BDD into capability prose per the capability's design constraint (multi-process topology property, not testable in-process).

## Scope Delivered

### Two Independent Behaviors

1. **Cart Race (PR #60, test-only)**
   - Real-DB integration test proving the documented last-write-wins behavior
   - No production code changes to cart logic
   - Test-owned barrier using only public Sequelize APIs
   - Deterministic invariant assertions + sequential documentation assertion
   - No cart production code modified

2. **Registration Race (PR #61, fix + test)**
   - Repository-layer translation of `SequelizeUniqueConstraintError` → `UserAlreadyExistsException`
   - 6-line addition to `SequelizeUserRepository.ts`
   - Unit test (RED→GREEN) of the translation
   - Integration test (real object graph, real DB, real temp files) asserting the full path
   - Confirms no orphaned avatar file on the losing registration
   - Sequential path unchanged; error message stays 400 (as per proposal)

## Merged Commits

| Commit | PR | Title | Impact |
|--------|----|----|--------|
| aebbb01 | #60 | `test(backend): add real-DB cart race integration test` | `SequelizeShoppingCartRepository.integration.test.ts` + cart helpers in `testDb.ts` |
| f7716a2 | #61 | `fix(backend): translate UniqueConstraintError in user registration races` | `SequelizeUserRepository.ts`, `UserAlreadyExistsException.ts`, `SequelizeUserRepository.test.ts`, `SequelizeUserRepository.integration.test.ts` + registration helpers in `testDb.ts` |

Both committed to `main` and verified post-merge.

## Verification Evidence

### Pre-Merge Verification (per `verify-report`)

**Build & Lint**: PASS — `pnpm run type-check` (0 errors), `pnpm run lint` (0 findings)

**Tests (on integration branch)**:
- `pnpm --filter backend test`: 667 passed, 667 total (all unit suites green)
- `pnpm --filter backend test:integration`: 12 passed, 12 total (both new integration tests + existing suite)
- Flake confidence: 6 consecutive cart-race runs green, 3 registration-race runs green (zero flakes)

**Spec Compliance**: 7/8 scenarios compliant at runtime per verify-report's Success Criteria table. One scenario (`Rate limit is enforced per process, not globally`) was flagged as untestable in-process — it describes a multi-process deployment property outside jest's scope. **Resolution**: Spec phase corrected this by moving the rate-limit guarantee into the requirement's prose under "Documented Concurrency Non-Guarantees" and removed the executable GIVEN/WHEN/THEN scenario, so the final spec carries no untestable scenarios.

**Design Compliance**: All design decisions followed: barrier uses only public Sequelize APIs (zero production impact), unique-violation translation is repository-layer only (narrowest blast radius), registration test uses real object graph + `req`/`res` doubles + real temp files, no cart production code touched.

**TDD Evidence**: RED independently reproduced (reverting `SequelizeUserRepository.ts` to base made the test fail), GREEN confirmed (667 unit tests pass after modification).

### Post-Merge Verification (by orchestrator on `main`)

After both PRs merged, the orchestrator ran the full suite on `main`:
- `pnpm --filter backend test`: 667/667 passed
- `pnpm --filter backend test:integration`: 12/12 passed  
- `pnpm run lint`: 0 findings
- `pnpm run type-check`: 0 errors
- Architecture check: clean
- CI integration job (`.github/workflows/ci.yml:103-108`): both new `*.integration.test.ts` files matched, required check green

## Spec Sync Summary

### New Capability: Concurrency Guarantees

**File**: `openspec/specs/concurrency-guarantees/spec.md`  
**Source**: Delta spec `openspec/changes/concurrency-tests/specs/concurrency-guarantees/spec.md`  
**Action**: Mechanical copy (mechanical contract verified: empty `diff -r`)

**Contents**:
- **Requirement: Cart Sync Last-Write-Wins** (Accepted Tradeoff)
  - 2 scenarios: concurrent cart syncs resolve by commit order, losing write not merged
  - Asserts InnoDB serialization by commit order, no version token needed
  
- **Requirement: Documented Concurrency Non-Guarantees**
  - Migration check: read-only at boot, no schema writes (executable scenario in spec)
  - Rate limiting: per-process `MemoryStore` is an accepted scaling limitation, not a correctness bug (documented in prose per design constraint; removed executable scenario that was impossible to test in-process)
  - Stock decrement: out of scope (covered by existing test)

### Modified Capability: User & Auth Domain

**File**: `openspec/specs/user-auth/spec.md`  
**Baseline**: Existing spec with flat `### Scenario N:` format (preserved)  
**Changes**: Two scenarios updated to include concurrent paths

**Scenario 3: Business Error Propagation**
- Updated to name both sequential and concurrent duplicate-email paths
- Added new Scenario 3b for concurrent race path (losing registration MUST throw `UserAlreadyExistsException`, not raw `SequelizeUniqueConstraintError`)
- Baseline Scenario 3 remains untouched; Scenario 3b is additive

**Scenario 4: Controller Dependency Injection and API JSON Authentication**
- Updated to name both sequential and concurrent registration paths
- Added new Scenario 4b for concurrent race path (exactly one 201, one 400 with same body as sequential, no 500, no orphaned file)
- Baseline Scenario 4 remains untouched; Scenario 4b is additive

**Unchanged**: Scenarios 1, 2, 5 (domain layering, use case DTOs, infrastructure adapters) remain verbatim.

**Merge verification**: Baseline format preserved; 2 MODIFIED requirements updated with concurrent scenarios; no destructive changes.

## Tasks Completion

**Total tasks**: 20  
**Completed**: 20 (all phases 1-7)

**Phase 7 Verification** (marked complete with evidence):
- 7.1: Full unit suite green (667/667) ✓
- 7.2: Integration tests green with flake confidence (12/12, 6×cart, 3×registration no flakes) ✓
- 7.3: Lint clean (0 findings) ✓
- 7.4: Type-check clean (0 errors) ✓
- 7.5: Both `*.integration.test.ts` files matched by jest config, excluded from fast suite, picked up by CI integration job ✓
- 7.6: All 5 Success Criteria Met per verify-report cross-check table ✓

## Spec-Authoring Correction

**Issue Found**: `specs/concurrency-guarantees/spec.md` initially included "Rate limit is enforced per process, not globally" as an executable GIVEN/WHEN/THEN scenario. This scenario describes a multi-process deployment property (each process enforces independently, combined limit may exceed configured value) that no in-process Jest suite can exercise.

**Why It's Not a Code Defect**: The proposal and design correctly left rate limiting out of scope; `MemoryStore` is the default and `loginLimiter` / `registerLimiter` do not pass a `store` option, so the per-process behavior is correct.

**Resolution**: Spec phase updated the requirement to move rate-limit guarantee into the "Documented Concurrency Non-Guarantees" requirement's prose as a known scaling limitation, removed the executable scenario, and retained the only *testable* non-guarantee (migration check is read-only).

**Final Verdict**: Spec is now complete and all executable scenarios are testable at runtime.

## Risks

**None**. All implementation tasks complete, all verification green, all spec issues resolved, no orphaned work.

## Key Learnings

1. Test-owned concurrency barriers (using `SELECT ... FOR UPDATE` and `Promise.allSettled`) can prove invariant correctness without injecting production seams.
2. Translating driver errors at the repository adapter layer minimizes blast radius and keeps error cleanup colocated with the domain exception.
3. Spec scenarios must distinguish between properties provable in-process (e.g., boot-time read-only behavior) and deployment-topology properties (e.g., per-process rate limit scoping), folding the latter into capability prose rather than executable BDD.
4. Real-DB integration tests for concurrency must assert the actual persistence outcome, not just absence of crashes — disjoint payloads + order-insensitive set comparison proves no-merge invariant.
5. Concurrent registration test using real temp files and bounded file-existence polling catches orphan-file bugs that mock-spy approaches would miss.

## Files Archived

- `proposal.md`
- `design.md`
- `tasks.md` (Phase 7 checkboxes marked complete)
- `specs/concurrency-guarantees/spec.md` (delta, fully incorporated into main specs)
- `specs/user-auth/spec.md` (delta, merged into main with concurrent scenarios)
- `verify-report.md`
