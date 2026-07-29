# Proposal: Remediate Architecture Boundary Violations

## Intent

Unblock parent PR 3 by correcting four false `resolution.local` findings for existing `.astro` targets and removing the unused private application barrel that produces the remaining 16 findings. Preserve the parent guardrail's fail-closed, no-baseline contract without changing runtime behavior.

## Problem and Goals

- The current checker reports 20 current-tree diagnostics, blocking the parent wiring slice.
- Restore the already-approved existence-only `.astro` resolution behavior.
- Remove `backend/src/application/use-cases/index.ts`; repository consumers use individual files and no external compatibility guarantee exists.
- Keep the remediation explicit, reviewable, and within a forecast of 36–70 authored changed lines.

## Scope

### In Scope (implementation scope; not performed by this proposal)

- Add the exact existing-local `.astro` resolver fallback in `backend/tools/architecture/engine.js`, with a focused regression test in `backend/src/architecture/__tests__/architecture-boundaries.test.js`.
- Delete `backend/src/application/use-cases/index.ts`; do not rewrite imports.

### Out of Scope / Non-goals

- No baseline, suppression, broad allowlist, unresolved fallback, or rule weakening.
- No page/component import rewrites, domain moves, runtime/product changes, CI/package wiring, or parent artifact/runtime-ledger edits.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `architecture-verification-gate`: restore its parent-approved exact `.astro` existence resolution while retaining fail-closed behavior for every other unresolved local.

## Dependencies and Parent Relationship

This requires a separate approved remediation issue. Issue #37 remains parent context only. Parent PR 3 stays preserved and blocked until this prerequisite merges; then it may rebase and resume. Existing dirty parent files must not be absorbed.

## Impact

The checker/test and one unused backend source barrel are affected; frontend domain barrels remain unchanged. No API, schema, page, component, or runtime behavior changes are planned.

## Risks and Rollback

- An undiscovered external barrel consumer could break; the private package has no external compatibility guarantee, and repository search found none.
- An over-broad `.astro` fallback could hide missing locals; require an explicit local `.astro` specifier and an existing repository-root target.
- Rollback is one PR revert: restore the deleted barrel and revert only the resolver/test changes. Parent artifacts and runtime remain untouched.

## Delivery Boundary and Success Criteria

- Exactly one prerequisite PR; forecast 36–70 authored lines, below the 400-line review budget (low risk; no chaining).
- [ ] Focused regression proves existing `.astro` targets resolve and other unresolved locals still fail closed.
- [ ] Architecture check no longer reports the 20 known findings without exceptions or baselines.
- [ ] No prohibited paths change; parent PR 3 remains blocked until prerequisite merge.

Proposal completion records intent only; it does **not** authorize implementation.
