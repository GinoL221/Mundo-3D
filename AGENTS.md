# Engineering Standards — Mundo-3D

Source of truth for AI agents working in this repo (OpenCode, Claude Code, Codex). Migrated from the Obsidian vault's agent decisions on 2026-07-20.

## Code quality

- Prefer small, cohesive modules with clear responsibilities and loose coupling. File length is advisory: refactor when responsibilities blur or coupling, complexity, or testability degrades—not to satisfy a numeric limit.
- No `console.log` in production code paths; no dead code or commented-out blocks in commits.

## Secrets

- Never hardcode secrets (API keys, DB credentials, JWT secrets) in source. Read them from environment variables.
- `.env` holds real values, lives in `.gitignore`, and is never committed. `.env.example` holds the same variable names with placeholders and IS committed.
- If a secret ever lands in git history (even if deleted afterwards), rotate it immediately — history preserves the value.

## Frontend security

- No inline scripts in backend-served HTML or server templates (Express/EJS). Client logic there lives in external `.js` files so helmet's CSP defaults are not weakened.
- The Astro frontend may use framework-idiomatic `<script is:inline>` only for tiny pre-render initializers (e.g. theme init to avoid FOUC); everything else goes through Astro's bundled scripts.

## Git

- Conventional commits (`feat:`, `fix:`, `chore:`, ...). No AI attribution in commit messages.
- Never push, pull, delete remote branches, or run any remote-mutating git operation without asking the user first.
