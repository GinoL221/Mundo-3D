# Design: Documentation and Specification Drift

## Technical Approach

Run the approved bounded formatter reset, then only the two semantic corrections. Pin immutable `HEAD`, compare original meanings, normalize exactly `openspec/config.yaml` and `backend/jest.config.js` with repository `prettier@3.8.3`, apply `store` → `domains` and `npm` → pnpm wording, then run deterministic semantic and check-only acceptance. Forecast: approximately 50 style-only lines plus two edits, below 400. No application, package-script, CI, test-selection, runtime, database, README, or unrelated formatting changes.

## Architecture Decisions

| Decision | Choice | Alternative rejected | Rationale |
|---|---|---|---|
| Formatter boundary | Prettier only on the two targets using root `.prettierrc`. | Repository-wide formatting or new dependency. | Resolves the baseline blocker without expansion. |
| Meaning baseline | Pin `HEAD`; compare structures in memory. | Final text or mutable index only. | Detects unapproved drift reproducibly. |
| YAML parser | Bundled Prettier 3.8.3 parser; fail closed if unavailable. | Silent `yaml`/`js-yaml` addition. | Preserves dependency transparency. |
| Forecast | Approximately 50 style-only lines plus two corrections. | Unbounded formatter cleanup. | Protects the 400-line review budget. |

## Data Flow

```text
Pinned HEAD blob + worktree originals -> meaning comparison
  -> Prettier --write (two targets) -> two semantic corrections
  -> Jest/YAML equivalence -> check-only acceptance
```

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/config.yaml` | Modify | Normalize, then change `store: frontend/src/store/` → `domains: frontend/src/domains/`; no other YAML meaning changes. |
| `backend/jest.config.js` | Modify | Normalize, then replace the comment command with `pnpm --filter backend test:integration`; exported settings remain unchanged. |

## Interfaces / Contracts

Inventory entries are `{ target, statement, evidence, status, action }`; unverified entries are excluded. Sequence: pin SHA; compare originals with no allowed delta; normalize both targets; apply corrections; compare; accept.

Jest comparison: obtain `preEditSha` with fixed `execFileSync("git", ["rev-parse", "--verify", "HEAD^{commit}"], { cwd: repoRoot, encoding: "utf8", shell: false })`; obtain before bytes with fixed `execFileSync("git", ["cat-file", "blob", `${preEditSha}:backend/jest.config.js`], { cwd: repoRoot, encoding: "utf8", shell: false })`; read after bytes from the fixed worktree path. Load both in an isolated in-memory CommonJS `vm` with throwing `require`; sort object keys recursively, preserve arrays, reject non-JSON/cycles, `JSON.stringify`, and compare bytes. Errors or mismatch fail closed; no index, network, or scratch file.

YAML comparison uses repository `prettier@3.8.3`: format each source in memory with `.prettierrc`, await `prettier.__debug.parse(text, { parser: "yaml" })`, and canonicalize the AST, removing positions/comments but retaining mapping/sequence order, keys, scalar node types/values, tags, anchors, and aliases. Normalize the before tree only by `architecture.frontend.store: frontend/src/store/` → `architecture.frontend.domains: frontend/src/domains/`; compare full trees byte-for-byte. Missing Prettier, parser, expected AST fields, or version fails closed; add no dependency.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Baseline/inventory | Original meanings and evidence. | Pin SHA; compare both targets; reject unsupported claims or drift. |
| Normalization | Exactly two targets and forecast. | Fixed `pnpm exec prettier --write openspec/config.yaml backend/jest.config.js`; inspect allowlist and line count. |
| Acceptance | Syntax, formatting, meaning, and scope. | `git diff --check`, exact changed paths `{openspec/config.yaml, backend/jest.config.js}`, Prettier `--check`, `node --check`, and both equivalence checks. No tests, migrations, DB, or network. |

## Threat Matrix

Normalization and acceptance are a bounded subprocess boundary. Git, Node, pnpm, and Prettier use fixed argv/cwd, no-shell APIs, local inputs, no live DB/network/migrations, and no untrusted shell interpolation. `--write` is limited to two targets; `--check` is non-mutating. Any error, unexpected path, parser/AST error, mismatch, or missing tool fails closed.

| Boundary | Applicability | Safe / failure behavior | Planned RED test |
|---|---|---|---|
| Validation-command execution | Applicable — Git/Node/pnpm/Prettier run. | Fixed args; any error/output anomaly rejects. | Metacharacter/path injection cannot alter argv. |
| Documentation-like paths | Applicable — only two allowlisted files. | Other/missing/non-regular paths reject; docs are never executed. | README.sh-like path is rejected and not run. |
| Git repository selection | Applicable — fixed cwd and pinned blob. | Wrong root/blob rejects; no fallback. | Nested cwd and relative/absolute path cases. |
| Commit state | Applicable — immutable `HEAD`; index ignored. | Unresolvable SHA/blob or original drift rejects. | Staged-only, unstaged-only, empty-index cases. |
| Push state | N/A — no push/refspec mutation. | No command. | None. |
| PR commands | N/A — no PR automation. | No command. | None. |

## Migration / Rollout

No migration. On failure, restore both targets to the pinned baseline and rerun; keep no partial edits. Stop and ask if forecast exceeds 400 lines, unrelated files, executable changes, dependency addition, live operation, or unsupported claim appears. Never authorize or execute `ALTER TABLE Product ADD COLUMN stock ...` or baseline adoption.

## Open Questions

None.
