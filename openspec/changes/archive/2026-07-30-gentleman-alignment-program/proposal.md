# Proposal: Gentleman Alignment Program

## Intent

Govern the complete alignment program: sustainable quality through executable boundaries, explicit contracts, and behavior-focused verification. Completion means remaining gaps are normal bounded work, not zero debt.

## Scope

### In Scope

- Sequence five slices: documentation drift, runtime resilience, authentication, cart consistency, and catalog scalability.
- Require contract-first SDD, behavioral evidence, rollback, and explicit product, security, operations, and database gates.
- Preserve the architecture/CI baseline; target 400 or fewer authored changed lines, with ask-on-risk for exceptions.

### Out of Scope

- This phase creates the proposal; no specs, design, tasks, or code.
- Exhaustive debt elimination, percentage-driven testing, or slice expansion.
- `ALTER TABLE Product ADD COLUMN stock ...` or live baseline adoption; schema rollout is a separate operational lane.
- Inferred product, security, operational, or live-database decisions.

## Capabilities

### New Capabilities

- `documentation-and-specification-drift`: verified documentation/configuration alignment.
- `runtime-resilience`: liveness, readiness, and graceful shutdown contracts.

### Modified Capabilities

- `user-auth`: authentication model, lifecycle, and compatibility.
- `cart-service` and `cart-domain`: synchronization, duplicates, limits, reconciliation, and checkout.
- `api-products-layer`: pagination, filtering, ordering, and response compatibility.

## Approach

Run independently reviewable SDD slices. Correct verified drift first; then define runtime health/shutdown semantics. Require product/security approval for authentication, product/API approval for cart, and product/API/scalability approval for catalog work. Contracts and verification plans precede implementation.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/config.yaml`, `README.md`, `backend/jest.config.js` | Modified | Documentation drift. |
| `backend/index.js`, `backend/src/app.js` | Modified | Runtime resilience. |
| `backend/src/infrastructure/security/`, `frontend/src/domains/auth/` | Modified | Authentication after approval. |
| `backend/src/application/use-cases/SyncCartUseCase.ts`, cart validators, `frontend/src/domains/cart/` | Modified | Cart consistency. |
| Product ports/use cases/repository, `frontend/src/pages/products.astro` | Modified | Catalog scalability. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ambiguous contracts cause regressions | High | Gate work on explicit decisions. |
| Program breadth overloads reviewers | Medium | Independent slices and 400-line budget. |
| Static checks hide runtime gaps | Medium | Behavioral and integration evidence. |
| Schema drift causes unsafe changes | High | Separate authorization for live operations. |

## Rollback Plan

Revert each slice to its prior contract/configuration and rerun verification. No live-schema rollback is defined because no live operation is authorized.

## Dependencies

- Current architecture, CI, coverage, and repository evidence remain the baseline.
- Slice-specific product, security, operational, and live-database approvals require separate decisions and rollback plans.

## Success Criteria

- [ ] Documentation/configuration matches the current pnpm/Astro/Jest/Vitest/CI topology.
- [ ] Every slice has an approved contract, bounded scope, rollback, and behavioral verification.
- [ ] Authentication, cart, catalog, and runtime decisions precede implementation.
- [ ] Remaining gaps are manageable bounded work, without exhaustive-debt or unapproved-schema claims.
