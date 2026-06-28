# Proposal: Move Backend to Dedicated Subdirectory

## Intent

The backend source code, entry point, configs, and dependencies currently live at the repository root, breaking monorepo symmetry with `frontend/`. This creates root pollution, couples backend identity to the workspace orchestrator, and violates Screaming Architecture — the root should be an agnostic orchestrator, not the backend package.

## Scope

### In Scope
- Move `src/`, `index.js`, `public/`, `.sequelizerc`, `.env`, `.env.example` to `backend/`
- Move backend-specific configs (`tsconfig.json`, `eslint.config.js`, `jest.config.js`) to `backend/`
- Create `backend/package.json` with all backend dependencies and devDependencies (except `prettier`)
- Transform root `package.json` into a workspace orchestrator (no dependencies, only delegated scripts)
- Update `pnpm-workspace.yaml` to list `backend` and `frontend` (remove `'.'`)
- Move all backend devDependencies to `backend/` except `prettier` (stays at root)
- Use `git mv` for all moves to preserve file history

### Out of Scope
- Frontend changes (stays in `frontend/` as-is)
- CI workflow file changes (root scripts delegate transparently)
- Database schema or migration changes
- New features or refactoring of backend code
- Docker or deployment configuration (none exist)

## Capabilities

### New Capabilities
None — this is a pure structural refactor.

### Modified Capabilities
None — no spec-level behavior changes.

## Approach

1. Create `backend/` directory
2. `git mv` all backend source files (`src/`, `index.js`, `public/`)
3. `git mv` backend-only configs (`.sequelizerc`, `tsconfig.json`, `eslint.config.js`, `jest.config.js`)
4. `git mv` environment files (`.env`, `.env.example`)
5. Create `backend/package.json` inheriting backend deps/devDeps (minus `prettier`)
6. Rewrite root `package.json` as workspace orchestrator with delegated scripts
7. Update `pnpm-workspace.yaml`: `['backend', 'frontend']`
8. Update `openspec/config.yaml` paths to reflect `backend/` prefix
9. Run `pnpm install` to regenerate lockfile
10. Verify: `pnpm -r lint`, `pnpm -r test`, `pnpm --filter backend dev`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/` → `backend/src/` | Moved | All backend source code |
| `index.js` → `backend/index.js` | Moved | Backend entry point |
| `public/` → `backend/public/` | Moved | Static assets served by Express |
| `.sequelizerc` → `backend/.sequelizerc` | Moved | Sequelize CLI config |
| `.env` / `.env.example` → `backend/` | Moved | Environment variables |
| `tsconfig.json` → `backend/tsconfig.json` | Moved | TypeScript config |
| `eslint.config.js` → `backend/eslint.config.js` | Moved | ESLint config |
| `jest.config.js` → `backend/jest.config.js` | Moved | Jest config |
| `package.json` (root) | Modified | Becomes workspace orchestrator |
| `pnpm-workspace.yaml` | Modified | Maps `backend` + `frontend` |
| `openspec/config.yaml` | Modified | Path prefixes updated |
| `.prettierrc` (root) | Unchanged | Stays at root, workspace-wide |
| `.gitignore` (root) | Unchanged | Stays at root, workspace-wide |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sequelize CLI path resolution breaks | Medium | Update `.sequelizerc` paths; run from `backend/` via `pnpm --filter` |
| Import paths break in moved files | Low | All imports are relative within `src/`; no absolute root paths |
| `dotenv` fails to find `.env` | Low | `pnpm --filter backend` sets cwd to `backend/` |
| Lockfile conflicts with open branches | Medium | Coordinate merge; regenerate lockfile after move |

## Rollback Plan

1. `git revert` the move commit (single atomic commit with `git mv` preserves revertibility)
2. Run `pnpm install` to regenerate lockfile
3. Verify `pnpm run dev`, `pnpm run lint`, `pnpm test` pass at root

## Dependencies

- No external dependencies or prerequisites

## Success Criteria

- [ ] `pnpm --filter backend dev` starts the Express server
- [ ] `pnpm --filter backend test` passes all existing tests
- [ ] `pnpm --filter backend lint` passes with zero errors
- [ ] `pnpm --filter frontend dev` starts Astro dev server (unchanged)
- [ ] `pnpm -r test` and `pnpm -r lint` work from root
- [ ] `git log --follow backend/src/app.js` shows full history
- [ ] Root `package.json` has zero `dependencies` or backend-specific `devDependencies`
- [ ] CI workflow passes without changes to `.github/workflows/ci.yml`
