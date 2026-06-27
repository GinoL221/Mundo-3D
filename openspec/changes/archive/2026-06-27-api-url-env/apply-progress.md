## Implementation Progress

**Change**: api-url-env
**Mode**: Standard

### Completed Tasks
- [x] 1.1 Create `frontend/.env` with `PUBLIC_API_URL=http://localhost:3031`.
- [x] 1.2 Create `frontend/.env.example` with `PUBLIC_API_URL=http://localhost:3031`.
- [x] 1.3 Create `frontend/src/config.ts` exporting `API_URL` with fallback to `http://localhost:3031`.
- [x] 2.1 Refactor `frontend/src/pages/index.astro` to import `API_URL` and use it in fetch calls.
- [x] 2.2 Refactor `frontend/src/pages/login.astro` to import `API_URL` and use it in fetch calls.
- [x] 2.3 Refactor `frontend/src/pages/product.astro` to import `API_URL` and use it in fetch calls.
- [x] 2.4 Refactor `frontend/src/pages/products.astro` to import `API_URL` and use it in fetch calls.
- [x] 2.5 Refactor `frontend/src/pages/register.astro` to import `API_URL` and use it in fetch calls.
- [x] 2.6 Refactor `frontend/src/store/cart.ts` to import `API_URL` and use it in fetch calls.
- [x] 3.1 Verify gitignore status of `frontend/.env` (must be ignored).
- [x] 3.2 Run frontend build `pnpm --filter frontend build` to verify compilation.
- [x] 3.3 Run typecheck `pnpm type-check` to verify no import errors exist.

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `frontend/.env` | Created | Set local API URL. |
| `frontend/.env.example` | Created | Template API URL. |
| `frontend/src/config.ts` | Created | Centralized API URL resolution. |
| `frontend/src/pages/index.astro` | Modified | Import and use `API_URL`. |
| `frontend/src/pages/login.astro` | Modified | Import and use `API_URL`. |
| `frontend/src/pages/product.astro` | Modified | Import and use `API_URL`. |
| `frontend/src/pages/products.astro` | Modified | Import and use `API_URL`. |
| `frontend/src/pages/register.astro` | Modified | Import and use `API_URL`. |
| `frontend/src/store/cart.ts` | Modified | Import and use `API_URL`. |

### Deviations from Design
None

### Issues Found
None

### Remaining Tasks
None

### Workload / PR Boundary
- Mode: size:exception
- Current work unit: Complete migration
- Boundary: Complete migration
- Estimated review budget impact: Tiny (~20 lines of changes).

### Status
12/12 tasks complete. Ready for verify
