# Design: Verification Baseline and CI Gates

## Technical Approach

Preserve Express/Astro boundaries. Add verification-only scripts, selection, coverage, validation, and CI. Fast tests exclude both MySQL extensions; integration retains them. No product, schema, auth/cart/stock, or runtime changes. Branch protection is authorized delivery only.

## Architecture Decisions

| Decision | Choice | Alternative rejected | Rationale |
|---|---|---|---|
| Selection | Separate fast/integration Jest configs. | Mixed flags. | Deterministic selection. |
| Validation | Pin Astro checker/compiler; retain tests/check/build. | Omission/framework change. | Official diagnostics. |
| Types | Add Supertest declarations; keep strict. | Ambient declarations/exclusions. | Preserves strictness. |
| Coverage | JS+TS, exclusions/reports/risk map, 50% guards. | Higher thresholds first. | Reviewable baseline. |
| Gate | `quality`, `integration`, `e2e` → `always()` gate → `success`. | `continue-on-error`. | Unavailability stays red. |
| Branch protection | `main` SHALL require live `verification-gate`. | Unobserved/unstable or unavailable-as-compliant. | Safe maintainer decision. |

## Data Flow

```text
pnpm install --frozen-lockfile
  → quality (lint, types, fast tests, Astro, coverage)
  → integration (MySQL health, migrations, real-DB Jest)
  → e2e (MySQL health, browsers, Playwright)
  → verification-gate (always; all results success)
  → observe live context → authorize → protect main
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Modify | Scripts/lint. |
| `backend/package.json` | Modify | Coverage/scripts/types. |
| `frontend/package.json` | Modify | Checker/compiler. |
| `pnpm-lock.yaml` | Modify | Dependencies. |
| `backend/jest.config.js` | Modify | Selection/coverage/guards. |
| `backend/scripts/generate-coverage-risk-map.js` | Create | Risk map. |
| `.github/workflows/ci.yml` | Modify | Jobs/artifacts/gate. |
| `README.md`, `openspec/config.yaml` | Modify | Commands/evidence. |
| GitHub `main` settings | Delivery action | Live context; no apply mutation. |

## Interfaces / Contracts

Root contracts are `test:fast`, `test:integration`, `test:coverage`, and `frontend:check`; backend coverage emits the risk map; frontend check is `astro check`. Fast tests use no MySQL; integration retains both extensions. Invalid/unavailable validation is non-zero; the gate accepts only `success`.

```ts
type BranchProtectionDeliveryResult =
  | { status: 'configured'; requiredContext: 'verification-gate'; evidence: Evidence }
  | {
      status: 'unavailable';
      requiredContext: 'verification-gate';
      reason: 'context-not-observed' | 'unstable-context' | 'permission-denied' | 'capability-unavailable';
      evidence: Evidence;
    };
```

Before mutation, verify live GitHub context on a successful run; never use an absent/unstable name. Preserve typed `unavailable`; fail-closed enforcement is incomplete.

## Testing Strategy

| Layer | Command / evidence |
|---|---|
| Fast | `pnpm test:fast`; list excludes integration. |
| Coverage | Coverage + risk map; JSON/LCOV/map; 50% guards. |
| Validation/build | Backend types, frontend check/test/build, lint. |
| MySQL/E2E | Health/migrate/integration; browser install/E2E. |
| Delivery | Live-context validation and protection readback; unavailable remains typed. |

## Threat Matrix

| Boundary | Applicability | Design response / RED tests |
|---|---|---|
| Documentation-like paths | N/A — no executable classification. | None. |
| Git repository selection | N/A — no path selector. | None. |
| Commit state | N/A — no commit automation. | None. |
| Push state | N/A — no ref automation. | None. |
| PR commands | N/A — no PR commands. | None. |

No `continue-on-error`; failures remain red. Missing/unstable context or unavailable capability prevents mutation and returns `unavailable`.

## Migration / Rollout

No migration. Sequence:

1. Apply repository code/config and docs without remote mutation.
2. Publish/observe the `verification-gate` workflow job successfully on GitHub; record SHA, URL, exact context.
3. With explicit authorization, re-validate and require exactly `verification-gate` on `main`.
4. Otherwise do not mutate; preserve `unavailable` and report incomplete compliance.

Rollback removes only the new context, with authorization; preserve existing protections. Evidence: run/check URL+SHA, validation, protection readback. Later tasks MUST separate delivery/evidence/rollback.

## Work Units and Forecast

Implementation units: baseline; CI/gate; documentation. Delivery unit: branch protection, evidence, rollback (no authored lines).

Forecast: 9 authored files (8 modified, 1 created), 300–360 lines, below 400; delivery adds no authored lines. **400-line budget risk: Low.** **Decision needed before apply: Yes — authorize remote mutation separately; implementation may proceed.** **Chained PRs recommended: No.**

## Requirement-to-Design Traceability

| Requirement / scenario | Design evidence |
|---|---|
| R1/S1 Checks execute | Quality, integration, E2E, validation, lint, coverage. |
| R2/S2 Mandatory failure blocks integration | `always()`/`success`; authorized `main` context. |
| R3/S3 Verification-only update | No product/schema/runtime changes. |
| R4/S4 Commands distinct | Dual Jest configs/scripts. |
| R5/S5 Validation actionable | Strict types and independent checks. |
| R6/S6 Documentation matches execution | README/config match pnpm behavior. |
| R7/S7–S9 Scope/threshold outcomes | JS+TS, exclusions, reports, 50% guards. |
| R8/S10 Baseline honest | Revision/lock identity and Tier 0 map. |
| R9/S11 Behavior evidence leads | Existing contracts lead. |

## Resolved Maintainer Decision

GitHub `main` SHALL require exact `verification-gate`; failed, skipped, or unavailable verification prevents merge. Configure only after stable observation and authorization; design/apply performs no remote mutation.
