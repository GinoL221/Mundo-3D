# Design: Remediate Architecture Boundary Violations

## Technical Approach

Keep `discover → AST → resolve → classify → rules → diagnostics → exit`. `check.js` and all parent CLI/package/CI wiring remain untouched. After TypeScript resolution fails, `engine.js` derives the repository root from the absolute source path's recognized `backend/src` or `frontend/src` anchor; an unrecognized source gets no Astro fallback. This preserves the existing two-argument `resolveEdges(edges, options)` call without using `cwd` or a parent-CLI contract.

The fallback accepts only an exact relative `.astro` file, resolves it from `path.dirname(edge.source)`, and validates canonical paths with `fs.realpathSync.native`. The canonical target must be under the canonical root and `stat().isFile()`; missing, dangling, outside-root, or directory targets stay unresolved. A valid target remains an opaque ordinary local edge.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Root ownership | Derive inside `engine.js` from the source's `backend/src` or `frontend/src` anchor; never from `cwd` or `check.js`. | Works with the unchanged parent command and keeps temporary-tree tests deterministic. |
| Astro syntax | Accept only `./` or one-or-more leading `../` segments followed by non-empty path segments and a case-sensitive final `.astro`. | Prevents extension, directory/index, alias, package, and absolute-path inference. |
| Symlinks | Compare `realpath` root/target, reject canonical escapes, and require a regular canonical target; return the lexical candidate for existing rule-relative paths. | Allows an in-root symlink safely while rejecting outside or non-file targets. |
| Barrel | Prove no exact consumers, then delete `backend/src/application/use-cases/index.ts`. | Smaller than weakening the application rule and preserves direct-file imports. |

## Data Flow

```text
edge → TypeScript resolver
        ├─ hit → existing classification/rules
        └─ miss → exact syntax → realpath containment → opaque local or unresolved-local
local edge → existing evaluator → diagnostics / exit code
```

## File Changes

Implementation paths in the clean prerequisite worktree:

| Path | Action |
|---|---|
| `backend/tools/architecture/engine.js` | Modify resolver fallback and root derivation. |
| `backend/src/architecture/__tests__/architecture-boundaries.test.js` | Add RED/GREEN syntax, symlink, containment, and opacity cases. |
| `backend/src/application/use-cases/index.ts` | Delete after consumer proof. |

Delivery manifest, copied as one directory after tasks: `openspec/changes/remediate-architecture-boundary-violations/{exploration.md,proposal.md,design.md,tasks.md}` and `openspec/changes/remediate-architecture-boundary-violations/specs/architecture-verification-gate/spec.md`. `tasks.md` is future output. No `check.js`, package, workflow, parent-change, apply-progress, or runtime-ledger path is authorized.

## Interfaces / Contracts

`resolveEdges(edges, options) → Edge[]` remains the public engine call. The fallback syntax rejects `./file`, `../file.js`, `./file.astro?query`, `./file.astro#hash`, `./dir`, `./dir/`, `./dir/index`, `@/file.astro`, `package/file.astro`, `/absolute/file.astro`, Windows-drive/UNC paths, empty/dot path segments, and aliases/bare packages. `./dir/index.astro` is accepted only as that exact regular file; no index is inferred. TypeScript remains authoritative for its supported resolutions. Canonical containment uses `path.relative(canonicalRoot, canonicalTarget)` and rejects absolute results or `..` escapes.

## Testing Strategy

**Prerequisite evidence, on a clean `main`-based worktree:** write RED tests first and run the existing runner: `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand`. Cover an existing exact file, opaque target, missing/directory targets, in-root and outside/dangling symlinks, traversal, every rejected syntax family, and existing ESM/CommonJS/alias/package fail-closed behavior. Prove the barrel has no exact repository consumer before deletion. Run `pnpm --filter backend type-check`, `pnpm run frontend:build` when applicable; validate `git status/diff --name-only` against the manifest, `git diff --check`, and source-size limits. Run a targeted checker only if already available on clean `main` without importing dirty wiring; otherwise record `N/A`, never PASS. Verify rollback restores the barrel and reverts only engine/test.

**Parent-only evidence:** after this prerequisite merges and dirty PR 3 rebases, run `pnpm --filter backend architecture:check` and require zero current diagnostics, then verify parent CI/package wiring. Zero diagnostics is final parent-resumption evidence, not a prerequisite PASS when command wiring is absent.

**Workload and handoff:** implementation forecast is 36–70 authored lines across the three implementation paths. Total review burden is intentionally not declared low: `sdd-tasks` MUST count additions plus deletions for all five new-change artifacts above plus implementation paths, then invoke the cached `ask-on-risk` guard before apply if total exceeds 400. After tasks, perform a read-only/copy handoff of only the new change directory to the clean worktree; verify the exact relative-path manifest and SHA-256 hashes at source/destination, and confirm the dirty parent status/paths are unchanged.

## Threat Matrix

| Boundary | Applicability / response |
|---|---|
| Documentation-like paths | N/A — no discovery or executable-file classification change. |
| Git repository selection | N/A — fixed worktree handoff, no repository selector automation. |
| Commit state | N/A — engine reads neither index nor staged state. |
| Push state | N/A — no ref or push resolution. |
| PR commands | N/A — no PR command composition or automation. |

## Migration / Rollout

No migration. Implement only in the clean prerequisite worktree, merge it, then rebase/resume parent PR 3. Implementation rollback restores `index.ts` and reverts only `engine.js` plus its regression test; planning rollback removes only `exploration.md`, `proposal.md`, `specs/architecture-verification-gate/spec.md`, `design.md`, and future `tasks.md`. Parent `check.js`, package, CI, parent artifacts, and runtime ledger remain untouched.

## Open Questions

None.
