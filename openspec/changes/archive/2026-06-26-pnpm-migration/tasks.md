# Tasks: Migrate package manager from npm to pnpm using workspaces

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~45 lines of manual edits (plus lockfiles deletion and creation) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units
| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Complete migration to pnpm and workspace configuration | PR 1 | Base branch; contains configurations, deleted npm lockfiles, new pnpm lockfile, and updated CI workflows. |

## Phase 1: Infrastructure and Setup
- [x] 1.1 Remove npm lockfiles: delete root `/package-lock.json` and if present `/frontend/package-lock.json`.
- [x] 1.2 Create `/pnpm-workspace.yaml` with packages configuration and security hardening rules.
- [x] 1.3 Update `/package.json`: add packageManager (pnpm@11.0.9) and engines fields.

## Phase 2: Dependency Resolution
- [x] 2.1 Run `pnpm install` in the root folder to generate the unified `pnpm-lock.yaml`.
- [x] 2.2 Run root API tests (`pnpm test`) to ensure dependencies resolve correctly.
- [x] 2.3 Run frontend build (`pnpm --filter frontend build`) to check for esbuild/native binaries compilation.

## Phase 3: CI/CD & Documentation
- [x] 3.1 Update `/.github/workflows/ci.yml`: replace npm setup actions with `pnpm/action-setup@v4` and configure package caching.
- [x] 3.2 Update `/README.md` to reflect pnpm workspace commands instead of npm.

## Phase 4: Verification & Security Check
- [x] 4.1 Verify that `.env` and `/frontend/.env` are not commited by running `git status` and git ignore checks.
- [x] 4.2 Run lint check (`pnpm lint`) and type checks (`pnpm type-check`) to guarantee no phantom dependencies are used.
