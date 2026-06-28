# Tasks: Move Backend to Dedicated Subdirectory

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~60 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Not needed |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Move files and adjust configs | PR 1 | Single atomic PR to keep workspace compile-safe |

## Phase 1: Preparation

- [x] 1.1 Update packages list in [pnpm-workspace.yaml](file:///home/ginopc/Desarrollo/Mundo-3D/pnpm-workspace.yaml) replacing `'.'` with `'backend'`
- [x] 1.2 Update backend paths in [config.yaml](file:///home/ginopc/Desarrollo/Mundo-3D/openspec/config.yaml) to include `backend/` prefix
- [x] 1.3 Create target directory `backend/` in repository root

## Phase 2: File Movement

- [x] 2.1 Move `src/` directory to `backend/src/` using `git mv`
- [x] 2.2 Move `public/` directory to `backend/public/` using `git mv`
- [x] 2.3 Move [index.js](file:///home/ginopc/Desarrollo/Mundo-3D/index.js) to `backend/index.js` using `git mv`
- [x] 2.4 Move [.sequelizerc](file:///home/ginopc/Desarrollo/Mundo-3D/.sequelizerc) to `backend/.sequelizerc` using `git mv`
- [x] 2.5 Move [tsconfig.json](file:///home/ginopc/Desarrollo/Mundo-3D/tsconfig.json) to `backend/tsconfig.json` using `git mv`
- [x] 2.6 Move [eslint.config.js](file:///home/ginopc/Desarrollo/Mundo-3D/eslint.config.js) to `backend/eslint.config.js` using `git mv`
- [x] 2.7 Move [jest.config.js](file:///home/ginopc/Desarrollo/Mundo-3D/jest.config.js) to `backend/jest.config.js` using `git mv`
- [x] 2.8 Move [.env.example](file:///home/ginopc/Desarrollo/Mundo-3D/.env.example) to `backend/.env.example` using `git mv`
- [x] 2.9 Manually move `.env` from root to `backend/.env` (if present)

## Phase 3: Workspace Reconfiguration

- [x] 3.1 Create `backend/package.json` with dependencies and devDependencies from [package.json](file:///home/ginopc/Desarrollo/Mundo-3D/package.json) (excluding Prettier)
- [x] 3.2 Rewrite [package.json](file:///home/ginopc/Desarrollo/Mundo-3D/package.json) as a workspace orchestrator with delegated scripts
- [x] 3.3 Run `pnpm install` from workspace root to regenerate `pnpm-lock.yaml`

## Phase 4: Verification

- [x] 4.1 Run `pnpm --filter backend lint` from root to verify backend linter passes
- [x] 4.2 Run `pnpm --filter backend test` from root to verify backend Jest tests pass
- [x] 4.3 Run `pnpm -r lint` and `pnpm -r test` to verify recursive workspace commands
- [x] 4.4 Run `pnpm --filter backend dev` to verify Express server starts successfully
- [x] 4.5 Run `git log --follow backend/src/app.js` to verify file history is preserved
