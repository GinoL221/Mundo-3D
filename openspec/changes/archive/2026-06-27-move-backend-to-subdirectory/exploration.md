## Exploration: Move backend code to a dedicated subdirectory

### Current State
The project has a monorepo-like layout but the backend source code (`src/`), entry point (`index.js`), public static assets (`public/`), and various configuration files (`tsconfig.json`, `eslint.config.js`, `jest.config.js`, `.sequelizerc`) live at the root of the repository. The Astro frontend lives in a dedicated `frontend/` subdirectory. The pnpm workspace configuration maps the root `'.'` as the backend package and `frontend` as the frontend package.

### Affected Areas
- `pnpm-workspace.yaml` — Needs to map `'backend'` and `'frontend'` instead of `'.'` and `'frontend'`.
- `package.json` (root) — Needs to be replaced with a workspace-wide package manager configuration that orchestrates backend and frontend scripts, while moving the actual dependencies and scripts to `backend/package.json`.
- `.sequelizerc` — Needs to be moved to `backend/` and its commands must be run within the backend context.
- `.env` and `.env.example` — Need to be moved to `backend/` and loaded in the backend context.
- `.github/workflows/ci.yml` — Runs `pnpm run lint` and `pnpm test` at the root. Will rely on the new workspace orchestration scripts at root.

### Approaches
1. **Symmetric Monorepo with Workspace-Level Orchestration (Recommended)** — Move all backend source code, public files, database configurations, environment files, linting, testing, and typescript configurations to `backend/`. Keep monorepo-wide tools (Prettier, Git, GitHub Actions, OpenSpec, and Agent config) at the root. Configure root scripts to delegate tasks using `pnpm --filter` and workspace recursion.
   - Pros:
     - Extremely clean repository root.
     - Symmetric architecture (`backend/` + `frontend/`).
     - Decouples backend dependencies from the workspace root.
     - Keeps CI workflows working without modifying workflow files.
   - Cons:
     - Requires moving multiple files and renaming the root `package.json` package.
   - Effort: Medium

2. **Backend Subdirectory with Root Config Preservation** — Move only `src/`, `public/`, and `index.js` to `backend/`, but keep configurations like `tsconfig.json`, `eslint.config.js`, `jest.config.js`, and `.sequelizerc` at the root.
   - Pros:
     - Fewer files to move.
   - Cons:
     - Pollution of the root directory with backend-only configurations.
     - Highly complex configuration paths (configs at root referencing paths deep in subdirectories).
     - Breaks the concept of a clean monorepo where packages are self-contained.
   - Effort: High (due to path resolution complexity in configs)

### Recommendation
Approach 1 is highly recommended. It creates a clean, standard, and symmetric monorepo structure where each package (`backend/` and `frontend/`) is fully self-contained with its own dependencies, typescript config, testing config, and linting config. Monorepo-level configs (.gitignore, .prettierrc, .github/, openspec/) remain at the root to orchestrate the workspace.

### Risks
- **Database migrations running directory**: If migrations are run from the root, the path resolution in `.sequelizerc` could fail. This is mitigated by defining clear package scripts in `backend/package.json` and running them via `pnpm --filter backend`.
- **Environment variables loading**: Node process must be run with working directory set to `backend/` to load `.env` correctly. We will configure the root `dev` scripts to use `pnpm --filter backend` which guarantees the working directory is set to `backend/`.

### Ready for Proposal
Yes — The backend structure and dependencies are completely mapped. We are ready to proceed with generating a formal proposal (`proposal.md`).
