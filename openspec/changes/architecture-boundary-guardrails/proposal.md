# Proposal: Executable Architecture Boundary Guardrails

## Intent

Mundo-3D's boundaries are convention-only: passing tests do not prevent domain-to-infrastructure or frontend cross-domain imports. Add verification-only guardrails that fail regressions before merge, without moving production files or changing runtime behavior. This Gentleman alignment change is independent of blocked `verification-baseline-and-ci-gates`.

## Goals, Stakeholders, and Outcomes

- **Stakeholders:** maintainers, contributors, reviewers, and CI owners.
- Fail on forbidden resolved local dependencies, unresolved local imports, and static ESM/CommonJS violations.
- Keep valid imports green, classify external packages separately, and provide actionable diagnostics.
- Add one standalone blocking step to current CI, independent of baseline.
- Keep production source files at **≤250 lines**; decompose the checker if its design would exceed that limit.

## Scope

### In Scope

- Backend domain/application/database rules, frontend TypeScript locality, and static `import`/`require` resolution.
- Separate production, test, tool, migration, and configuration classifications.
- Explicit reviewable composition-root allowlists for current startup/routes and frontend page/layout/component/script surfaces.
- Allowed/forbidden fixtures, command wiring, and current-CI integration.

### Out of Scope

- Production moves, runtime/product behavior, new package boundaries, or blocked baseline redesign.
- Internal `.astro` parsing/rules or dynamic-loading proof. `.astro` internals are a future extension boundary.

## Capabilities

### New Capabilities

- `backend-architecture-boundaries`: backend layer direction and import safety.
- `frontend-domain-locality`: TypeScript domain isolation and composition exceptions.
- `architecture-verification-gate`: executable command and blocking current-CI step.

### Modified Capabilities

- None.

## Rules and Verification

- Domain permits domain contracts/standard types; application uses ports/DTOs/domain, never concrete adapters; database cannot depend on production domain/application/infrastructure.
- Frontend domains may use own modules, approved config, and external packages—not other domains, pages, layouts, UI, or backend.
- Resolve static ESM and CommonJS imports. An unresolved **local** import fails closed and blocks the check; external-package classification is separate and does not excuse local-resolution failure.
- Fixtures must prove green domain-to-port, application-to-port, adapter/database, external-package, and allowlisted-composition edges; red domain-to-infrastructure, application-to-database/concrete-adapter, database-to-production-layer, CommonJS outward, cross-domain, and unresolved-local edges.
- Exceptions are path-specific; no blanket directory permission. Current `.astro` surfaces are documented entry points only, not parsed.

## Approach, Risks, and Rollback

Use a small resolved-import checker and fixture tests, reusing the current toolchain; leave exact structures to design. False positives are mitigated by classification, explicit exceptions, and diagnostics. Rollback removes the command/CI invocation and checker test assets; production remains untouched.

## Review Forecast and Success Criteria

Forecast: **180–320 authored lines**, unless evidence contradicts it. **400-line guard: low risk; chained PRs: not recommended.** Reassess if Astro support or broader tooling is needed.

- [ ] Current CI blocks forbidden or unresolved-local edges independently of `verification-baseline-and-ci-gates`.
- [ ] Allowed fixtures pass; forbidden fixtures fail with source/target diagnostics.
- [ ] No production file moves or runtime changes; source-file size rule is preserved.
