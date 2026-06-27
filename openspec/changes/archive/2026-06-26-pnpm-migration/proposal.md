# Proposal: Migrate package manager from npm to pnpm using workspaces

## Intent
Migrate package manager from npm to pnpm, converting the decoupled monorepo (Express API in root + Astro frontend in /frontend) into a unified pnpm workspace. This solves duplicate node_modules issues, speeds up local and CI installation times, and enforces strict dependency boundaries.

## Scope

### In Scope
- Delete package-lock.json and frontend/package-lock.json.
- Create pnpm-workspace.yaml in root defining '.' and './frontend' as members.
- Run `pnpm install` at the root to generate a unified pnpm-lock.yaml.
- Update .github/workflows/ci.yml to setup pnpm and cache pnpm store.
- Configure packageManager (pnpm@11.0.9) and engines fields in root package.json.
- Update local setup instructions in README.md.

### Out of Scope
- Upgrading other dependencies or changing code logic.
- Rewriting scripts unless needed for command updates.

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Approach
Implement Approach 2 (PNPM Workspace Monorepo) from exploration. We will configure a single workspace lockfile. The installation will use pnpm's strict layout (no flat dependency tree, no phantom imports allowed).

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `/package-lock.json` | Removed | Will be deleted. |
| `/frontend/package-lock.json` | Removed | Will be deleted. |
| `/pnpm-workspace.yaml` | New | Defines the monorepo workspace members. |
| `/package.json` | Modified | Locked pnpm version and engines. |
| `/.github/workflows/ci.yml` | Modified | Updated build/test action steps to use pnpm action. |
| `/README.md` | Modified | Command updates. |

## Risks
| Risk | Likelihood | Mitigation |
|------|--------|-------------|
| Phantom dependencies in code | Medium | Run full lint, type-check, and tests after pnpm install. Declare missing packages direct if any fail. |
| CI/CD break on push | Low | Test CI locally or verify config thoroughly. |

## Rollback Plan
Discard all changes, restore package-lock.json and frontend/package-lock.json, and run npm install.

## Dependencies
None

## Success Criteria
- [ ] Successful workspace installation with a single lockfile (`pnpm-lock.yaml`).
- [ ] Local build and tests (jest/astro) complete successfully under pnpm.
- [ ] CI pipeline builds and tests pass using pnpm.
