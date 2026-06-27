# Tasks: Refactor hardcoded API URLs to use environment variables

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~20 lines of manual edits |
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
| 1 | Centralize API URL configuration and update pages/stores | PR 1 | Contains environment config files, config module, and updated pages and stores. |

## Phase 1: Environment and Setup
- [x] 1.1 Create `frontend/.env` with `PUBLIC_API_URL=http://localhost:3031`.
- [x] 1.2 Create `frontend/.env.example` with `PUBLIC_API_URL=http://localhost:3031`.
- [x] 1.3 Create `frontend/src/config.ts` exporting `API_URL` with fallback to `http://localhost:3031`.

## Phase 2: Implementation / Refactoring
- [x] 2.1 Refactor `frontend/src/pages/index.astro` to import `API_URL` and use it in fetch calls.
- [x] 2.2 Refactor `frontend/src/pages/login.astro` to import `API_URL` and use it in fetch calls.
- [x] 2.3 Refactor `frontend/src/pages/product.astro` to import `API_URL` and use it in fetch calls.
- [x] 2.4 Refactor `frontend/src/pages/products.astro` to import `API_URL` and use it in fetch calls.
- [x] 2.5 Refactor `frontend/src/pages/register.astro` to import `API_URL` and use it in fetch calls.
- [x] 2.6 Refactor `frontend/src/store/cart.ts` to import `API_URL` and use it in fetch calls.

## Phase 3: Verification
- [x] 3.1 Verify gitignore status of `frontend/.env` (must be ignored).
- [x] 3.2 Run frontend build `pnpm --filter frontend build` to verify compilation.
- [x] 3.3 Run typecheck `pnpm type-check` to verify no import errors exist.
