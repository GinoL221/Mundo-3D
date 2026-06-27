# Archive Report: api-url-env

**Date**: 2026-06-27
**Change ID**: api-url-env
**Original path**: `openspec/changes/api-url-env/`
**Archive path**: `openspec/changes/archive/2026-06-27-api-url-env/`

## Executive Summary
This change refactored hardcoded API URLs to environment variables in the frontend. All verification checks have successfully passed, and all planned implementation tasks are completed.

## Verification Verdict: PASS
The verification phase passed with the following evidence:
- **Build and compilation check**: `pnpm --filter frontend build` completed successfully.
- **Type-checking**: `pnpm type-check` completed without errors.
- **Lint check**: `pnpm run lint` succeeded.
- **Backend API tests**: `pnpm test` executed and passed.
- **Security Audit**: `.env` is ignored by git, and zero inline scripts are present in updated pages.

## Specs Synced
- Source: `openspec/changes/api-url-env/specs/spec.md`
- Destination: `openspec/specs/api-url-env/spec.md`

## Completed Tasks
- [x] Create `frontend/.env` and `frontend/.env.example`
- [x] Create `frontend/src/config.ts` exporting centralized `API_URL`
- [x] Refactor Astro pages to import and use centralized `API_URL`
- [x] Refactor Cart store to use centralized `API_URL`
- [x] Verify build, typecheck, lint, and security constraints
