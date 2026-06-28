# Apply Progress: Move Backend to Dedicated Subdirectory

**Change**: move-backend-to-subdirectory
**Mode**: Standard (Strict TDD active, but all tasks are purely structural/config-based, so triangulation and unit tests were skipped with explicit justification)

## Implementation Summary

All 20 tasks across the 4 phases of the structural refactor have been successfully implemented and verified. The backend source, entry point, public assets, and config files were relocated using `git mv` to preserve history, the monorepo workspace orchestrator configuration was created, and all quality checks (linting, Jest unit tests, dev server startup, and git history blame tracking) passed successfully.

### Completed Tasks

#### Phase 1: Preparation
- [x] 1.1 Update packages list in `pnpm-workspace.yaml` replacing `'.'` with `'backend'`
- [x] 1.2 Update backend paths in `config.yaml` to include `backend/` prefix
- [x] 1.3 Create target directory `backend/` in repository root

#### Phase 2: File Movement
- [x] 2.1 Move `src/` directory to `backend/src/` using `git mv`
- [x] 2.2 Move `public/` directory to `backend/public/` using `git mv`
- [x] 2.3 Move `index.js` to `backend/index.js` using `git mv`
- [x] 2.4 Move `.sequelizerc` to `backend/.sequelizerc` using `git mv`
- [x] 2.5 Move `tsconfig.json` to `backend/tsconfig.json` using `git mv`
- [x] 2.6 Move `eslint.config.js` to `backend/eslint.config.js` using `git mv`
- [x] 2.7 Move `jest.config.js` to `backend/jest.config.js` using `git mv`
- [x] 2.8 Move `.env.example` to `backend/.env.example` using `git mv`
- [x] 2.9 Manually move `.env` from root to `backend/.env` (if present)

#### Phase 3: Workspace Reconfiguration
- [x] 3.1 Create `backend/package.json` with dependencies and devDependencies from `package.json` (excluding Prettier)
- [x] 3.2 Rewrite `package.json` as a workspace orchestrator with delegated scripts
- [x] 3.3 Run `pnpm install` from workspace root to regenerate `pnpm-lock.yaml`

#### Phase 4: Verification
- [x] 4.1 Run `pnpm --filter backend lint` from root to verify backend linter passes
- [x] 4.2 Run `pnpm --filter backend test` from root to verify backend Jest tests pass
- [x] 4.3 Run `pnpm -r lint` and `pnpm -r test` to verify recursive workspace commands
- [x] 4.4 Run `pnpm --filter backend dev` to verify Express server starts successfully
- [x] 4.5 Run `git log --follow backend/src/app.js` to verify file history is preserved

---

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: workspace config update | ➖ N/A |
| 1.2 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: openspec paths update | ➖ N/A |
| 1.3 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: directory creation | ➖ N/A |
| 2.1 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: directory relocation | ➖ N/A |
| 2.2 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: directory relocation | ➖ N/A |
| 2.3 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: file relocation | ➖ N/A |
| 2.4 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: file relocation | ➖ N/A |
| 2.5 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: file relocation | ➖ N/A |
| 2.6 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: file relocation | ➖ N/A |
| 2.7 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: file relocation | ➖ N/A |
| 2.8 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: file relocation | ➖ N/A |
| 2.9 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: file relocation | ➖ N/A |
| 3.1 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: package.json creation | ➖ N/A |
| 3.2 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: package.json rewrite | ➖ N/A |
| 3.3 | ➖ N/A (structural) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: lockfile regeneration | ➖ N/A |
| 4.1 | ➖ N/A (verification) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: verification step | ➖ N/A |
| 4.2 | ➖ N/A (verification) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: verification step | ➖ N/A |
| 4.3 | ➖ N/A (verification) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: verification step | ➖ N/A |
| 4.4 | ➖ N/A (verification) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: verification step | ➖ N/A |
| 4.5 | ➖ N/A (verification) | Unit | ➖ N/A | ➖ N/A | ➖ N/A | ➖ Triangulation skipped: verification step | ➖ N/A |

### Test Summary
- **Total tests written**: 0 (all tasks were purely structural or verification-based)
- **Total tests passing**: 244 (pre-existing test suite successfully executed and verified post-relocation)
- **Layers used**: Unit (52 test suites, 244 tests)
- **Approval tests** (refactoring): None (no JS/TS application logic was modified or refactored)
- **Pure functions created**: 0

---

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `pnpm-workspace.yaml` | Modified | Updated packages list replacing `'.'` with `'backend'` |
| `openspec/config.yaml` | Modified | Prepended `backend/` to all backend layers and entrypoints |
| `backend/` | Created | Target subdirectory for backend code |
| `backend/src/` | Moved | Moved from `src/` using `git mv` |
| `backend/public/` | Moved | Moved from `public/` using `git mv` |
| `backend/index.js` | Moved | Moved from `index.js` using `git mv` |
| `backend/.sequelizerc` | Moved | Moved from `.sequelizerc` using `git mv` |
| `backend/tsconfig.json` | Moved | Moved from `tsconfig.json` using `git mv` |
| `backend/eslint.config.js` | Moved | Moved from `eslint.config.js` using `git mv` |
| `backend/jest.config.js` | Moved | Moved from `jest.config.js` using `git mv` |
| `backend/.env.example` | Moved | Moved from `.env.example` using `git mv` |
| `backend/.env` | Moved | Manually moved gitignored env file from root |
| `backend/package.json` | Created | Backend-specific package.json containing all backend dependencies |
| `package.json` | Modified | Rewritten as workspace orchestrator with delegated scripts |
| `pnpm-lock.yaml` | Regenerated | Updated workspace dependency graphs |

## Deviations from Design
None — implementation matches design exactly.

## Issues Found
None. All tests passed, linter reported zero errors, and Express server successfully started on local port 3031.

## Workload / PR Boundary
- Mode: size:exception (Entire change done in a single atomic PR to preserve monorepo validity)
- Current work unit: Unit 1 (All tasks completed)
- Boundary: Starts with directory preparation and finishes with recursive verify checks
- Estimated review budget impact: Low (~60 changed lines in configs/package.json, other moves tracked by Git)

## Status
20/20 tasks complete. Ready for verify.
