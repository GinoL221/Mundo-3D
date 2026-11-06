# Engineering Standards — Mundo-3D

Project-wide guidance for coding agents. Keep changes scoped to the user's request and preserve existing behavior outside that scope. These rules do not grant permission to commit, publish, deploy, or perform destructive operations.

## Read the relevant sources first

| Area | Source of truth |
| --- | --- |
| Product scope, target experience, and implemented capabilities | [PRODUCT.md](PRODUCT.md) |
| Visual identity and interface design | [DESIGN.md](DESIGN.md), including its referenced design guidance |
| TypeScript and linting standards | [.agents/AGENTS.md](.agents/AGENTS.md) |
| Available commands | [package.json](package.json) and the relevant workspace's package scripts |
| Required CI checks | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| Dependency trust and release-age policies | [pnpm-workspace.yaml](pnpm-workspace.yaml) |

This file defines cross-cutting agent rules; it does not replace the documents above. `PRODUCT.md` separates target experience from implemented capabilities: do not treat demo goals as proof of implementation, public deployment, or operational safety. Read any more specific instructions applicable to the files being changed. If requirements conflict, surface the conflict before changing code; do not silently choose a different product, security, or quality policy.

## Contextual references (when relevant)

Repository requirements and approved decisions remain authoritative. Keep reusable procedures in the vault or conditional skills, not duplicated here; do not copy personal host settings, historical version snapshots, or another project's exceptions into this repository.

- Before dependency installation, updates, or package-manager configuration changes, read `01-Conocimiento/Tecnologías/Herramientas/npm-pnpm-security-hardening.md` through Obsidian MCP when available. Confirm the actual package manager, version, configuration scope and active repository policy; the note is context, not authorization to bypass security gates.
- Before visual frontend work, read `01-Conocimiento/Tecnologías/Herramientas/Adoptar el flujo de diseño en un proyecto avanzado.md` through Obsidian MCP when available, alongside `DESIGN.md` and its authoritative brand references. Choose a bounded process: refine existing UI with the relevant available skill; consider prototyping for new or structurally redesigned flows. Do not install tools or redesign stable screens merely to adopt a workflow.
- For a concrete unresolved technical or architectural question, optionally consult Gentleman Book MCP. Search the relevant chapter, read sufficient section context, cite the chapter and section, and contrast the recommendation with repository conventions and current official documentation for the versions in use. Do not consult it for routine tasks or treat examples as universal rules.

If a referenced note or MCP is unavailable, state that limitation and continue from repository evidence and official documentation where sufficient. Ask for missing context only when the proposed change depends on it; never invent note contents or assume access. Shared project rules must remain usable without the personal vault. Verify host-specific instruction and skill discovery before relying on automatic loading.

## Project notes in the vault

- Project note: `02-Proyectos/Mundo-3D.md`. Sync convention: `01-Conocimiento/Tecnologías/Herramientas/Engram-Vault-Sync.md`. Before proposing note changes, read both and the vault's `AGENTS.md` through Obsidian MCP; vault policy governs notes, repository policy governs code.
- At meaningful milestones, scope/architecture/deployment changes, significant blocker changes, or user-confirmed pauses/resumptions/closure, compare the note with available evidence and group relevant differences into one proposal. Follow the central convention; minor changes alone do not warrant an update.
- Include sources, exact destination sections, proposed changes, and unverified aspects; distinguish planned, implemented, merged, and deployed. Preserve dated history and separate note maturity, project status, and verification freshness.
- Wait for explicit approval of each concrete proposal before writing through Obsidian MCP, then read back and verify the result. This instruction does not authorize future vault writes; do not repeat declined or deferred proposals without new evidence or a user request.
- Periodic reviews run when the user initiates them; this file creates no timers or background synchronization. Do not copy operational logs or active task lists into project notes.
- If MCP is unavailable, report the limitation without a vault-filesystem fallback or claiming synchronization; continue repository work where otherwise authorized. The vault is optional context, not a prerequisite for working on this repository.

## Before changing anything

- Confirm the repository, worktree, branch, and existing changes. Never assume the current checkout matches a published PR or another worktree.
- Preserve unrelated tracked changes and untracked files. Do not reset, overwrite, stage, or clean them as part of another task.
- Inspect the existing implementation and contracts before proposing a change. Keep write ownership clear when multiple agents or sessions are active.
- Ask before expanding scope or performing destructive operations. Investigation and review requests stay read-only unless the user authorizes implementation.

## Architecture and code quality

- Preserve the backend's hexagonal boundaries: domain code must not depend on infrastructure; application use cases depend on domain contracts rather than concrete adapters.
- Keep frontend behavior within its domain and use existing shared contracts instead of coupling unrelated domains. Follow the checks in [backend/tools/architecture/engine.js](backend/tools/architecture/engine.js).
- Follow the TypeScript rules in [.agents/AGENTS.md](.agents/AGENTS.md), including avoiding explicit `any` and preserving type-aware linting. ESLint handles code quality; Prettier handles formatting.
- No `console.log` in production code paths; no dead code or commented-out blocks in commits.

## Secrets and frontend security

- Never hardcode API keys, DB credentials, JWT secrets, or other secrets. Read private configuration from environment variables.
- `.env` holds real values, lives in `.gitignore`, and is never committed. `.env.example` contains variable names with safe placeholders and is committed.
- Frontend-public configuration, including Astro `PUBLIC_*` variables, must never contain secrets. Anything shipped to the browser is public.
- If a secret lands in Git history, rotate it immediately; deleting it from the current source does not remove the exposure.
- No inline scripts in backend-served HTML or server templates (Express/EJS). Client logic there lives in external `.js` files; do not weaken CSP to accommodate a change.
- Astro may use `<script is:inline>` only for tiny pre-render initializers, such as theme initialization to avoid FOUC. Other client logic uses Astro's bundled scripts.
- Frontend visibility is not authorization. Protected operations must enforce authentication and permissions on the backend.

## Verification and dependencies

- Use the existing package scripts and the current CI workflow to determine applicable checks. Do not invent replacement runners or treat a focused test as proof that the full suite passed.
- Add or update regression coverage for changed behavior. Test availability alone does not mean strict TDD was selected; follow the explicitly configured workflow.
- Report what actually ran, what passed or failed, and what remains unverified. An interrupted run is not a PASS.
- Diagnose failures before rerunning. Do not silently skip checks, weaken assertions, raise test timeouts, or regenerate snapshots to make a gate pass. Review intentional visual changes before updating goldens.
- Preserve dependency trust and release-age policies in `pnpm-workspace.yaml`. Do not bypass them, disable audit gates, or add exceptions without explicit authorization.
- Keep manifests and the lockfile consistent; use the project's package manager and frozen-lockfile checks where required.

## Databases and shared resources

- Before DB-mutating tests or migrations, confirm the exact host and disposable schema. Test mode alone does not prove isolation; never fall back to a development or production database.
- Shared containers, networks, temporary files, and services may belong to another project. Verify ownership and obtain explicit authorization before stopping, deleting, or recreating them.
- When temporary service changes are authorized, capture the original state, arrange restoration, and verify it after success, failure, or interruption. Do not assume cleanup hooks ran after a tool timeout.
- Preserve diagnostic evidence. Do not use broad cleanup commands to resolve a resource problem without a reviewed, authorized scope.

## Git and delivery

- Use Conventional Commits (`feat:`, `fix:`, `chore:`, ...). No AI attribution in commit messages. This formatting rule is not permission to commit.
- Never push, pull, delete remote branches, or run any remote-mutating Git operation without asking the user first.
- Obtain explicit authorization before rewriting history, force-pushing, merging into the default branch, or deploying. An approved review or green checks do not grant delivery permission.
