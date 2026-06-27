# Proposal: Refactor hardcoded API URLs to use environment variables

## Intent
Remove hardcoded backend API URLs ('http://localhost:3031') from the Astro frontend pages and stores. Centralize the API URL resolution via environment variables to improve repository portability and security, ensuring that local setups work automatically (out of the box) and production configurations are injected at build time.

## Scope

### In Scope
- Create `frontend/.env.example` declaring `PUBLIC_API_URL`.
- Create `frontend/src/config.ts` exporting `API_URL` resolved from environment variables with a fallback to `http://localhost:3031`.
- Refactor frontend pages (`index.astro`, `login.astro`, `product.astro`, `products.astro`, `register.astro`) and stores (`cart.ts`) to import and use `API_URL` instead of hardcoded strings.
- Add `frontend/.env` (excluded via gitignore) for local configuration.

### Out of Scope
- Modifying backend Express code or endpoints.
- Introducing new UI elements or changes to the error handling interface.

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Approach
Implement Approach 2 (Centralized Configuration File) from exploration. We will create `frontend/src/config.ts` which exports `API_URL` initialized from `import.meta.env.PUBLIC_API_URL` with a fallback to `http://localhost:3031`. Client-side `<script>` tags and TypeScript stores will import and use this constant.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `/frontend/.env` | New | Local configuration variables (ignored). |
| `/frontend/.env.example` | New | Template for local configuration. |
| `/frontend/src/config.ts` | New | Configuration module exporting `API_URL`. |
| `/frontend/src/pages/index.astro` | Modified | Import `API_URL` and use in fetch. |
| `/frontend/src/pages/login.astro` | Modified | Import `API_URL` and use in fetch. |
| `/frontend/src/pages/product.astro` | Modified | Import `API_URL` and use in fetch. |
| `/frontend/src/pages/products.astro` | Modified | Import `API_URL` and use in fetch. |
| `/frontend/src/pages/register.astro` | Modified | Import `API_URL` and use in fetch. |
| `/frontend/src/store/cart.ts` | Modified | Import `API_URL` and use in fetch. |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Client-side import compiler errors | Low | Ensure correct relative imports in `<script>` tags. Verify local compilation and type-check passes. |

## Rollback Plan
Discard all local changes to restore the hardcoded `http://localhost:3031` fetches.

## Dependencies
None

## Success Criteria
- [ ] Centralized configuration file `config.ts` exists.
- [ ] No occurrences of hardcoded 'http://localhost:3031' (or port 3000) remain in pages and stores.
- [ ] Local build (`pnpm --filter frontend build`) and tests pass successfully.
- [ ] API calls succeed automatically using fallback when no `.env` is present.
