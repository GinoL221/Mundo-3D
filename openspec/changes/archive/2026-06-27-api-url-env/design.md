# Design: Refactor hardcoded API URLs to use environment variables

## Technical Approach
Introduce a centralized configuration module `frontend/src/config.ts` that resolves the API URL from Astro's public environment variables (`import.meta.env.PUBLIC_API_URL`) and exports it as `API_URL`. Refactor frontend pages and stores to import and use this constant.

## Architecture Decisions

### Decision: Centralized Environment Configuration
**Choice**: Create a single `frontend/src/config.ts` file exporting `API_URL`.
**Alternatives considered**: Direct access via `import.meta.env.PUBLIC_API_URL` in all pages (rejected due to code duplication and lack of single point of change).
**Rationale**: Simplifies maintenance, supports a development fallback value without manual configuration, and decouples pages from Astro-specific env variable names.

### Decision: Environment Variable Exclusions
**Choice**: Create `frontend/.env.example` (committed) and `frontend/.env` (excluded via gitignore).
**Alternatives considered**: Hardcode production URLs (rejected as it violates security best practices and cloud portabilities).
**Rationale**: Adheres to the Manejo-de-Secrets Obsidian standard. Ensures no local details or environment secrets are stored in version control.

## Data Flow
Client-side scripts and stores read configurations from the config module and direct API requests to the resolved URL:

    [Astro Page / TS Store] ──(reads)──→ [config.ts (API_URL)] ──(resolves)──→ [PUBLIC_API_URL / Fallback]
            │
            └──────(fetch request)──────→ [http://localhost:3031/api/...]

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `/frontend/.env` | Create | Local configuration variables (ignored). |
| `/frontend/.env.example` | Create | Example template for API URL configuration. |
| `/frontend/src/config.ts` | Create | Configuration module resolving and exporting `API_URL`. |
| `/frontend/src/pages/index.astro` | Modify | Import `API_URL` and update fetch calls. |
| `/frontend/src/pages/login.astro` | Modify | Import `API_URL` and update fetch calls. |
| `/frontend/src/pages/product.astro` | Modify | Import `API_URL` and update fetch calls. |
| `/frontend/src/pages/products.astro` | Modify | Import `API_URL` and update fetch calls. |
| `/frontend/src/pages/register.astro` | Modify | Import `API_URL` and update fetch calls. |
| `/frontend/src/store/cart.ts` | Modify | Import `API_URL` and update fetch calls. |

## Interfaces / Contracts
### frontend/src/config.ts
```typescript
export const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3031';
```

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit / Static | Import Validation | Verify all pages and stores compile successfully without import errors using `pnpm --filter frontend build` and `pnpm type-check`. |
| Security Check | Gitignore | Confirm `.env` is ignored by running `git check-ignore frontend/.env`. |

## Migration / Rollout
1. Step 1: Create `frontend/.env` and `frontend/.env.example`.
2. Step 2: Create `frontend/src/config.ts`.
3. Step 3: Refactor the 5 pages and 1 store to import and use `API_URL`.
4. Step 4: Verify the compilation build locally.
