# Proposal: Audit Gentleman Best Practices

## Intent

mundo-3d has critical security vulnerabilities (hardcoded session secret, no input validation, no CSRF) and no architectural separation (controllers own DB access, validation, and view rendering). This change fixes the most dangerous gaps first, then introduces a thin service layer and route organization so the project can scale from small to medium without a full hexagonal rewrite.

## Scope

### In Scope
- Move session secret to env variable; create `.env.example`
- Add global error-handling middleware (4-param Express pattern)
- Add `express-validator` to login route
- Remove corrupted/dead code in `postNewProduct.js:66-74`
- Fix cookie user lookup to exclude password
- Add `helmet` for security headers
- Add CSRF protection (`csurf`)
- Extract thin service layer (`src/services/`) between controllers and models
- Separate API routes into `src/routes/api/` from web routes
- Consolidate model associations to single location (remove duplicates)
- Fix multer filename race condition (use UUID only)
- Organize middleware into separate files (auth, validation, error handling)
- Install Jest + basic service tests
- ESLint + Prettier config
- GitHub Actions CI workflow

### Out of Scope
- Full hexagonal architecture rewrite (ports/adapters/use-case abstractions)
- Frontend redesign or EJS template refactoring
- Database migration (schema changes or new tables)
- Performance optimization (caching, query tuning)
- REST route standardization (separate future change)
- Structured logging (Winston/Pino)
- File upload size limits
- API response envelope standardization

## Capabilities

### New Capabilities
- `security-middleware`: Helmet headers, CSRF tokens, error-handling middleware, login validation chain, session secret from env
- `service-layer`: Thin service functions between controllers and Sequelize models (product service, user service)
- `api-routes`: Separated API router under `/api` with own middleware chain
- `developer-quality`: Jest setup, ESLint + Prettier, GitHub Actions CI, `.env.example`

### Modified Capabilities
- None (no existing specs to modify — this is the first SDD change)

## Approach

**3-phase incremental strategy — each phase is independently deployable.**

**Phase 1 — Security + Critical Cleanup**: Fix session secret, add error middleware, add login validation, remove dead code, fix password leak in cookie, add helmet + CSRF. Deployable immediately.

**Phase 2 — Layer Separation + Organization**: Extract services/, separate API routes, consolidate associations, fix multer race, organize middleware files. Deployable on top of Phase 1.

**Phase 3 — Quality + DX**: Jest + service tests, ESLint + Prettier, CI workflow, `.env.example`. Deployable on top of Phase 2.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app.js` | Modified | Session secret from env, error middleware, helmet, CSRF |
| `src/controllers/` | Modified | Delegates to services instead of direct DB calls |
| `src/services/` | New | Thin business logic layer |
| `src/routes/api/` | New | API routes separated from web routes |
| `src/routes/productsRoutes.js` | Modified | Remove API routes, fix multer filename |
| `src/routes/userRoutes.js` | Modified | Add validation chain, remove API routes |
| `src/middlewares/` | Modified | Organized into separate files |
| `src/database/models/index.js` | Modified | Single source of truth for associations |
| `src/controllers/products/postNewProduct.js` | Modified | Remove corrupted code |
| Root config | New | `.env.example`, `.eslintrc`, `.prettierrc`, `.github/workflows/ci.yml` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Refactoring without tests may introduce regressions | High | Phase 1 changes are additive (middleware, env); Phase 2 is structural but mechanical delegation |
| CSRF breaks existing form submissions | Medium | Add CSRF token to all EJS forms before enabling; test manually |
| Service extraction changes controller signatures | Low | Thin pass-through layer; controllers still own HTTP concerns |

## Rollback Plan

Each phase is a separate commit set. Revert the phase commit(s) to restore prior state. Phase 1 (security) is the only risky rollback — reverting it re-exposes vulnerabilities. Prefer fixing forward on Phase 1.

## Dependencies

- `helmet`, `csurf`, `express-rate-limit` (npm packages)
- `dotenv` (already in project)
- `jest`, `supertest` (dev dependencies)
- `eslint`, `prettier` (dev dependencies)

## Success Criteria

- [ ] Session secret comes from `process.env.SESSION_SECRET`, never hardcoded
- [ ] Unhandled errors return 500 instead of crashing the server
- [ ] Login route validates email format and password presence
- [ ] No dead/corrupted code in `postNewProduct.js`
- [ ] Cookie lookup excludes password field
- [ ] Security headers present (helmet)
- [ ] CSRF token required on all state-changing requests
- [ ] Controllers delegate business logic to services
- [ ] API routes live under separate router
- [ ] Associations defined in one place only
- [ ] `npm run lint` passes
- [ ] `npm test` runs at least one passing test
- [ ] CI workflow runs on push to main
