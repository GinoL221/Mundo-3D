# Design: Migrate package manager from npm to pnpm using workspaces

## Technical Approach
Convert the repository into a pnpm monorepo workspace. A single root lockfile 'pnpm-lock.yaml' will resolve all dependencies for both the root Express API and the frontend subfolder.

## Architecture Decisions

### Decision: Unified Monorepo Workspace
**Choice**: Use pnpm-workspace.yaml to declare root '.' and 'frontend' as members.
**Alternatives considered**: Independent pnpm setups in each folder (rejected due to duplication and friction).
**Rationale**: Centralizes package management, allows one single build cache in CI, and permits workspace filtering.

### Decision: Strict Dependency Resolution
**Choice**: Do not use 'shamefully-hoist=true' in .npmrc. Ensure any package requiring dependencies has them explicitly listed in its package.json.
**Alternatives considered**: Using shamefully-hoist=true (rejected as it allows phantom dependencies and violates secure/strict standards).
**Rationale**: Aligns with clean coding guidelines and prevents unexpected compile-time or runtime errors.

### Decision: Security Rules Enforcement
**Choice**: Explicitly verify and enforce that '.env' remains in '.gitignore'. Ensure no inline scripts are added. Maintain all new files (workspace YAML, CI actions) under the 250-line limit. Incorporate npm/pnpm Security Hardening Protocolo 2026.
**Alternatives considered**: No security hardening (rejected due to supply chain risks).
**Rationale**: Respects the Estandar-Cero-Scripts-Inline, Manejo-de-Secrets, Definition-of-Done-Tecnico vault rules, and applies defense in depth against package supply chain attacks (e.g. cooldown, strict builds, and exotic subdeps blocking).

## Data Flow
Not applicable for this package manager configuration change.

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `/package-lock.json` | Delete | Deprecated lockfile. |
| `/frontend/package-lock.json` | Delete | Deprecated lockfile. |
| `/pnpm-workspace.yaml` | Create | Workspace definition listing '.' and './frontend'. Under 10 lines. |
| `/package.json` | Modify | Add "packageManager": "pnpm@11.0.9" and "engines": {"node": ">=22"}. |
| `/.github/workflows/ci.yml` | Modify | Update setup-node/npm steps to pnpm/action-setup and pnpm install. |
| `/README.md` | Modify | Update development commands. |

## Interfaces / Contracts
### pnpm-workspace.yaml
```yaml
packages:
  - '.'
  - 'frontend'

# Security Hardening (npm/pnpm Security Hardening — Protocolo 2026)
minimumReleaseAge: 10080
trustPolicy: no-downgrade
strictDepBuilds: true
blockExoticSubdeps: true

allowBuilds:
  esbuild: true
```

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit/Integration | Root API Tests | Run `pnpm test` (executes Jest tests). |
| Integration/E2E | Frontend Build | Run `pnpm --filter frontend build` (Astro static compilation). |
| Security check | Gitignore | Confirm `.env` is ignored by running `git check-ignore .env` and `/frontend/.env`. |

## Migration / Rollout
1. Backup: Standard git branch.
2. Step 1: Remove package-lock.json and frontend/package-lock.json.
3. Step 2: Create pnpm-workspace.yaml.
4. Step 3: Edit package.json.
5. Step 4: Run `pnpm install` in root.
6. Step 5: Run tests and build locally.
7. Step 6: Update CI workflow and README.

## Open Questions
None.
