# Prevent pnpm lockfile reformat

## Objective

Prevent repository tooling from rewriting `pnpm-lock.yaml` into a non-canonical Prettier YAML layout that creates thousands of unrelated diff lines.

## Problem and rationale

The committed pnpm lockfile uses pnpm's compact YAML mapping style. An external Prettier invocation rewrites mappings such as `resolution: {integrity: ...}` into multiline mappings, producing a 6,321-line diff without dependency changes. The root `format` script intentionally scopes formatting to source JavaScript, TypeScript, and Astro files, but `.prettierignore` does not protect the package-manager artifact from editor or agent-wide formatting commands.

## Scope

- Confirm the reformatter and the repository paths that can invoke it.
- Exclude the root `pnpm-lock.yaml` from Prettier formatting through `.prettierignore`.
- Restore the lockfile to the committed pnpm-generated form.
- Verify that Prettier ignores the lockfile, the lockfile remains valid, and the dependency audit still passes.

## Constraints

- Do not change dependency resolutions or the pnpm override policy.
- Do not commit the 6,321-line formatting churn.
- Preserve all existing untracked artifacts.
- Keep source formatting behavior unchanged.

## Tasks

### LOCK-01 — Identify the reformatter

- Inspect repository scripts, Prettier configuration, ignore rules, Pi/lens effective configuration, and CI.
- Confirm whether pnpm, CI, or Prettier produces the expanded YAML layout.

Status: complete.

### LOCK-02 — Protect the package-manager artifact

- Add a focused `pnpm-lock.yaml` entry to `.prettierignore` with a comment explaining why the generated lockfile is excluded.
- Do not broaden the ignore rule to unrelated YAML files.

Status: complete.

### LOCK-03 — Restore and verify

- Restore only the accidental lockfile formatting diff.
- Verify Prettier reports the lockfile as ignored and does not rewrite it.
- Run `pnpm audit`, `git diff --check`, and status checks.
- Record the work-unit commit and update the active PR description if this fix remains on the branch.

Status: complete.

## Acceptance criteria

- `.prettierignore` protects `pnpm-lock.yaml` from repository/editor/agent Prettier invocations that honor ignore rules.
- `pnpm-lock.yaml` has no unrelated formatting churn.
- `pnpm audit` succeeds.
- The source formatting command remains scoped to source files.
- Existing untracked artifacts remain untouched.

## Checks

- `pnpm exec prettier --check pnpm-lock.yaml`
- `pnpm audit`
- `git diff --check`
- `git status --short --branch`

## Progress

- [x] Confirmed the diff is a Prettier-style YAML expansion, not a dependency resolution change.
- [x] Confirmed the root `format` script does not include YAML and CI does not run Prettier.
- [x] Confirmed `.pi-lens.json` does not define a formatter but the YAML file remains eligible for YAML tooling.
- [x] Add the focused Prettier ignore rule.
- [x] Restore the accidental lockfile formatting.
- [x] Verify the protected artifact and dependency audit.
- [x] Commit the work unit.
- [ ] Update active PR evidence after explicit push authorization.

## Verification evidence

- The expanded diff changes compact inline YAML mappings to multiline mappings with trailing commas and spaces consistent with `.prettierrc`.
- The repository's root `format` script targets only `backend/src/**/*.{js,ts}` and `frontend/src/**/*.{js,ts,astro}`.
- No versioned Husky/lefthook hook or CI formatter was found.
- The current branch's committed lockfile is valid and the previously green CI run is `35290171412`.
- `pnpm exec prettier --check pnpm-lock.yaml` exited 0; an explicit `pnpm exec prettier --write pnpm-lock.yaml` left the lockfile checksum and Git diff unchanged.
- `pnpm audit` exited 0 with no known vulnerabilities after one transient retryable `ECONNRESET` warning.
- `git diff --check` exited 0 and final status listed only `.prettierignore` as tracked modification plus preserved untracked artifacts.

## Work-unit commit

- `8d7fbf5` — `chore: protect pnpm lockfile from prettier`

## Next step

Keep the lockfile guard in the local work unit; push and update PR #153 only after explicit delivery authorization.
