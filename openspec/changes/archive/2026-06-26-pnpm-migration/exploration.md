## Exploration: Migrate package manager from npm to pnpm

### Current State
The project is structured as a decoupled monorepo containing a root API (Express/TypeScript) and a `frontend` folder (Astro 6.x). Both applications are managed independently using `npm`, each with its own `package.json` and `package-lock.json` file.

### Affected Areas
- `/package-lock.json` — Will be deleted and replaced by a pnpm lockfile.
- `/frontend/package-lock.json` — Will be deleted and replaced/integrated under pnpm.
- `/.github/workflows/ci.yml` — Needs updates to setup pnpm and cache pnpm dependencies instead of npm.
- `/README.md` — Needs commands updated from `npm` to `pnpm`.
- `/package.json` — Can include `packageManager` field to lock pnpm version, and potentially update workspace scripts.
- `/frontend/package.json` — Can include `packageManager` field or workspace properties.

### Approaches
1. **Independent PNPM Setup (Dual-Lockfile)**
   - Keep root and `frontend` as completely independent pnpm projects. Run `pnpm install` separately in both folders.
   - Pros: Simpler migration with minimal changes to project structure; mirrors existing npm setup exactly.
   - Cons: Developers have to run install in two separate places; misses out on pnpm workspace features like cross-filtering.
   - Effort: Low

2. **PNPM Workspace Monorepo (Single-Lockfile)**
   - Create a `pnpm-workspace.yaml` in the root directory. Configure `.` and `./frontend` as workspace members. Run a single `pnpm install` at the root to resolve all dependencies into a unified `pnpm-lock.yaml`.
   - Pros: Single lockfile, faster and deduplicated installs, unified developer experience (can run scripts in frontend using `pnpm --filter frontend <script>`), standard for modern monorepos.
   - Cons: Requires adding `pnpm-workspace.yaml`; slight learning curve for workspace-specific flags.
   - Effort: Medium

### Recommendation
We recommend **Approach 2 (PNPM Workspace Monorepo)**. It leverages pnpm's core strengths, creates a single source of truth for dependencies via one root lockfile, optimizes CI/CD execution time by caching a single lockfile, and provides a cleaner monorepo workflow.

### Risks
- **Node-linker and hoisting differences**: pnpm uses a semi-strict symlinked `node_modules` structure, which might hide undeclared/phantom dependencies. We will need to run the full test suite and build verification to ensure no packages fail because of strict resolution.
- **CI/CD migration**: Workflow steps in GitHub Actions need to setup pnpm first, which requires using `pnpm/action-setup@v4`.
- **Command discrepancies**: Developers must adjust to using `pnpm` instead of `npm`.

### Ready for Proposal
Yes
