# Design: Move Backend to Dedicated Subdirectory

## Technical Approach

Three-phase atomic operation: (1) `git mv` all backend files into `backend/`, (2) create root orchestrator `package.json` + update workspace config, (3) patch internal relative paths in configs that broke due to the move. All imports inside `src/` use relative paths (`./`), so application code requires zero content changes — only config files need path adjustments.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Move strategy | `git mv` per file/dir | Copy + delete; subtree split | Preserves `git log --follow` blame history in a single atomic commit |
| Root `package.json` role | Workspace orchestrator (zero deps) | Keep root as backend package | Enforces Screaming Architecture — root is agnostic, packages are self-contained |
| `prettier` location | Root `devDependencies` only | Each package | Formatting is workspace-wide policy; avoids version drift |
| `.npmrc` location | Stays at root | Move to `backend/` | pnpm reads `.npmrc` from the workspace root; moving it would break resolution |
| `coverage/` and `test-results.json` | Delete / gitignore (generated artifacts) | Move to `backend/` | These are generated, gitignored outputs — no need to `git mv` |
| `DB.md` and `README.md` | Stay at root | Move to `backend/` | Repo-level documentation; not backend-specific |
| `scripts/` (empty dir) | Drop — do not move | Move empty dir | Empty directory has no value; `git mv` on empty dir is a no-op anyway |

## Data Flow

No runtime data-flow changes. The only flow affected is the **developer command flow**:

```
Developer
  │
  ├─ pnpm run dev          → root package.json "dev" script
  │    └─ pnpm --filter backend dev  → backend/package.json "dev" script
  │         └─ nodemon index.js      (cwd = backend/)
  │
  ├─ pnpm run test         → root "test" script
  │    └─ pnpm -r test              → runs jest in backend/
  │
  └─ pnpm run lint         → root "lint" script
       └─ pnpm -r lint              → runs eslint in backend/
```

CI (`ci.yml`) calls `pnpm run lint` and `pnpm test` at root — both delegate via the new root scripts. **No CI file changes needed.**

## File Changes

### Phase 1: `git mv` (move as-is, no content changes)

| Source | Destination | Notes |
|--------|------------|-------|
| `src/` | `backend/src/` | All application code |
| `index.js` | `backend/index.js` | Entry point |
| `public/` | `backend/public/` | Static assets |
| `.sequelizerc` | `backend/.sequelizerc` | Sequelize CLI config |
| `.env` | `backend/.env` | Environment vars (gitignored, manual move if present) |
| `.env.example` | `backend/.env.example` | Environment template |
| `tsconfig.json` | `backend/tsconfig.json` | TypeScript config |
| `eslint.config.js` | `backend/eslint.config.js` | ESLint flat config |
| `jest.config.js` | `backend/jest.config.js` | Jest config |

### Phase 2: Create / rewrite files

| File | Action | Description |
|------|--------|-------------|
| `backend/package.json` | Create | Backend-specific package with all deps/devDeps (minus `prettier`) and backend scripts |
| `package.json` (root) | Rewrite | Workspace orchestrator: zero deps, delegated scripts only |
| `pnpm-workspace.yaml` | Modify | Replace `'.'` with `'backend'` in packages list |
| `openspec/config.yaml` | Modify | Update `structure.entrypoint` and layer paths to add `backend/` prefix |

### Phase 3: Configs requiring content patches post-move

| File | What changes | Why |
|------|-------------|-----|
| `backend/.sequelizerc` | No change needed | Paths are `./src/...` — relative to cwd, and `pnpm --filter backend` sets cwd to `backend/` |
| `backend/tsconfig.json` | No change needed | `rootDir: ./src`, `include: [src/**/*]` — all relative, still valid |
| `backend/eslint.config.js` | No change needed | `project: ./tsconfig.json` + `tsconfigRootDir: __dirname` — both resolve relative to file location |
| `backend/jest.config.js` | No change needed | `testMatch` and `collectCoverageFrom` use `**/src/**` globs — still valid |

**Key insight**: All four config files use **relative paths** (`./src/...` or `__dirname`). Since they move alongside `src/`, no internal path edits are needed. This is the safest outcome.

### Root `package.json` (new content)

```json
{
  "name": "mundo-3d",
  "version": "1.0.0",
  "private": true,
  "description": "Mundo-3D monorepo workspace",
  "packageManager": "pnpm@11.0.9",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "pnpm --filter backend dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "format": "prettier --write \"backend/src/**/*.{js,ts}\" \"frontend/src/**/*.{js,ts,astro}\"",
    "type-check": "pnpm --filter backend type-check",
    "frontend:dev": "pnpm --filter frontend dev",
    "frontend:build": "pnpm --filter frontend build"
  },
  "devDependencies": {
    "prettier": "3.8.3"
  }
}
```

### `backend/package.json` (derived from current root)

```json
{
  "name": "backend",
  "version": "1.0.0",
  "private": true,
  "description": "Mundo-3D backend — Express API server",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest",
    "lint": "eslint src/",
    "format": "prettier --write \"src/**/*.js\"",
    "type-check": "tsc --noEmit"
  },
  "dependencies": { /* all current dependencies unchanged */ },
  "devDependencies": { /* all current devDependencies MINUS prettier */ }
}
```

### `pnpm-workspace.yaml` (updated)

```yaml
packages:
  - 'backend'
  - 'frontend'
# (security hardening block unchanged)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Smoke | All existing tests still pass | `pnpm --filter backend test` from root |
| Smoke | Linter passes | `pnpm --filter backend lint` from root |
| Smoke | Recursive commands work | `pnpm -r test`, `pnpm -r lint` |
| Smoke | Dev server starts | `pnpm --filter backend dev` — verify Express binds to port |
| Smoke | Frontend unaffected | `pnpm --filter frontend dev` |
| History | Git blame preserved | `git log --follow backend/src/app.js` shows full history |

No new test code — this validates existing tests run in the new location.

## Migration / Rollout

Single atomic commit using `git mv`. Rollback: `git revert <commit>` + `pnpm install`.

`.env` is gitignored — must be moved manually by each developer. Document in commit message.

## Open Questions

- [x] All resolved per confirmed decisions in the proposal.
