## Exploration: remediate-architecture-boundary-violations

### Current State

Parent change `architecture-boundary-guardrails` has merged parser/resolution and rule slices. Its locally implemented wiring slice runs the standalone checker, but `pnpm --filter backend architecture:check` exits 1 with exactly 20 diagnostics:

- **16 `backend.application.contracts` edges** from one backend application barrel.
- **4 `resolution.local` edges** from three frontend domain barrels to existing `.astro` components.

The diagnostics are current-tree findings, not a baseline comparison. The checker currently scans `backend/src` and `frontend/src`, parses JavaScript/TypeScript only, and delegates local resolution to TypeScript. The approved parent design already states that `.astro` targets use existence-only resolution, but the current resolver does not implement that fallback.

#### Exact violation inventory

All backend diagnostics have the same source and rule. Each export is a convenience re-export of one application use-case class:

| # | Source | Target | Rule | Current purpose | Classification | Smallest remediation |
|---:|---|---|---|---|---|---|
| 1 | `backend/src/application/use-cases/index.ts` | `backend/src/application/use-cases/AuthenticateUserUseCase.ts` | `backend.application.contracts` | Barrel export of authentication use case | Valid internal barrel edge; rejected by the intentionally narrow application rule | Remove the unused barrel, or amend the rule narrowly; removal is smaller |
| 2 | same | `backend/src/application/use-cases/CreateProductUseCase.ts` | same | Barrel export of product creation use case | Same | Same |
| 3 | same | `backend/src/application/use-cases/CreateRememberTokenUseCase.ts` | same | Barrel export of remember-token creation use case | Same | Same |
| 4 | same | `backend/src/application/use-cases/DeleteProductUseCase.ts` | same | Barrel export of product deletion use case | Same | Same |
| 5 | same | `backend/src/application/use-cases/DeleteRememberTokenUseCase.ts` | same | Barrel export of remember-token deletion use case | Same | Same |
| 6 | same | `backend/src/application/use-cases/GetCartByUserIdUseCase.ts` | same | Barrel export of cart lookup use case | Same | Same |
| 7 | same | `backend/src/application/use-cases/GetCartDistinctCountUseCase.ts` | same | Barrel export of cart-count use case | Same | Same |
| 8 | same | `backend/src/application/use-cases/GetLatestProductUseCase.ts` | same | Barrel export of latest-product lookup use case | Same | Same |
| 9 | same | `backend/src/application/use-cases/GetProductByIdUseCase.ts` | same | Barrel export of product lookup use case | Same | Same |
| 10 | same | `backend/src/application/use-cases/GetUserByIdUseCase.ts` | same | Barrel export of user lookup use case | Same | Same |
| 11 | same | `backend/src/application/use-cases/ListProductsUseCase.ts` | same | Barrel export of product-list use case | Same | Same |
| 12 | same | `backend/src/application/use-cases/ListUsersUseCase.ts` | same | Barrel export of user-list use case | Same | Same |
| 13 | same | `backend/src/application/use-cases/RegisterUserUseCase.ts` | same | Barrel export of registration use case | Same | Same |
| 14 | same | `backend/src/application/use-cases/SyncCartUseCase.ts` | same | Barrel export of cart synchronization use case | Same | Same |
| 15 | same | `backend/src/application/use-cases/UpdateProductUseCase.ts` | same | Barrel export of product update use case | Same | Same |
| 16 | same | `backend/src/application/use-cases/VerifyRememberTokenUseCase.ts` | same | Barrel export of remember-token verification use case | Same | Same |

The barrel was introduced as part of a cleanup commit, but repository-wide search found no production or test import of `application/use-cases` as a directory. Controllers, routes, and tests import individual use-case files. Therefore these are not outward dependency leaks; they are unused application-to-application re-export edges that the rule correctly reports according to its current contract.

The four frontend diagnostics are:

| # | Source | Specifier / target | Rule | Current purpose | Classification | Smallest remediation |
|---:|---|---|---|---|---|---|
| 17 | `frontend/src/domains/auth/index.ts:4` | `./components/LoginForm.astro` → `frontend/src/domains/auth/components/LoginForm.astro` | `resolution.local` | Public domain barrel exposes the login page component | Existing same-domain target; resolver defect, not a locality violation | Add an exact existing-`.astro` resolver fallback matching the approved design |
| 18 | `frontend/src/domains/auth/index.ts:5` | `./components/RegisterForm.astro` → `frontend/src/domains/auth/components/RegisterForm.astro` | `resolution.local` | Public domain barrel exposes the registration page component | Same resolver defect | Same |
| 19 | `frontend/src/domains/cart/index.ts:2` | `./components/CartList.astro` → `frontend/src/domains/cart/components/CartList.astro` | `resolution.local` | Public domain barrel exposes the cart component | Same resolver defect | Same |
| 20 | `frontend/src/domains/products/index.ts:3` | `./components/ProductCard.astro` → `frontend/src/domains/products/components/ProductCard.astro` | `resolution.local` | Public domain barrel exposes the product-card template component | Same resolver defect | Same |

The TypeScript resolver returns no result for explicit `.astro` files even though all four targets exist. The parent design explicitly excludes `.astro` internals from parsing and permits manifest-level existence checks. This is a resolver/classification defect, not evidence of a frontend domain crossing into another domain or presentation surface.

### Affected Areas

- `backend/src/application/use-cases/index.ts` — unused 16-entry application barrel producing all 16 backend diagnostics.
- `backend/tools/architecture/engine.js` — local-resolution fallback is missing for existing `.astro` targets.
- `backend/src/architecture/__tests__/architecture-boundaries.test.js` — needs a regression case for existing `.astro` target resolution; current tests only prove `.astro` source non-parsing.
- `frontend/src/domains/{auth,cart,products}/index.ts` — mixed TypeScript/Astro public barrels are the four resolver inputs.
- `frontend/src/pages/{login,register,cart,index,products}.astro` — only affected if the fallback is rejected and the source-only alternative imports Astro components directly.
- Backend application, controller, route, and frontend domain service tests — no direct barrel consumers were found; no behavior test changes are expected for the preferred path.
- `.github/workflows/ci.yml` and `backend/package.json` — remain parent PR 3 wiring surfaces; do not change them in this prerequisite.
- `openspec/changes/architecture-boundary-guardrails/` — existing parent artifacts are context only and must not be modified.

### Approaches

1. **Correct the resolver and remove the unused backend barrel (recommended)** — implement the already-approved existence-only `.astro` resolution contract, add one focused regression test, and delete `backend/src/application/use-cases/index.ts`.
   - Pros: removes the only genuine current-source cleanup, fixes the checker defect instead of hiding it, preserves all runtime behavior, keeps `.astro` internals unparsed, and avoids new allowlists.
   - Cons: adds a small tool/test correction before parent wiring can resume; deleting a private barrel would break an undiscovered external consumer, although the backend package is private and repository search found none.
   - Effort: Low.

2. **Split frontend Astro components out of the domain TypeScript barrels** — remove four `.astro` exports and replace five page imports with direct component imports; still remove the backend barrel.
   - Pros: current diagnostics disappear without changing resolver code; page ownership becomes explicit.
   - Cons: changes five production page import sites, changes the domain barrel API, leaves the approved `.astro` resolver contract incorrectly implemented, and treats a valid same-domain edge as source debt.
   - Effort: Low.

3. **Add rule exceptions or a baseline** — allow application index re-exports and unresolved `.astro` specifiers, or record the 20 findings as a baseline.
   - Pros: minimal immediate diff.
   - Cons: weakens fail-closed verification, hides unresolved-local defects, contradicts the parent specification and the user's decision, and creates future drift.
   - Effort: Low implementation, unacceptable architectural cost.

### Recommendation

Use Approach 1 in two stacked-to-main prerequisite slices before resuming parent PR 3:

1. **Resolver correctness slice** — update `backend/tools/architecture/engine.js` to recognize only an explicit, existing local `.astro` target after TypeScript resolution fails; add the corresponding architecture test. Do not accept arbitrary unresolved locals, directory-wide Astro permissions, or a new allowlist. Forecast: approximately **20–40 authored changed lines** including the focused test.
2. **Application barrel cleanup slice** — delete the unused `backend/src/application/use-cases/index.ts`. No import rewrites are required because all repository consumers already import individual files. Forecast: **16 authored deletions**; allow **20–30 lines** only if a narrowly scoped regression/usage assertion is added.

After both slices merge, rebase the existing local PR 3 wiring branch onto the updated `main`, then rerun the package architecture check and parent verification. The new prerequisite implementation forecast is approximately **36–70 authored changed lines**, well below the 400-line budget; `400-line budget risk: Low` and `Chained PRs recommended: No` for this prerequisite itself. The existing stacked-to-main strategy remains unchanged for the parent chain.

The source-only frontend alternative is a fallback, not the recommendation. If maintainers explicitly forbid correcting the checker, it would be a separate small slice of roughly **14 authored changed lines** across three domain barrels and five page import replacements, verified with the frontend build. It should not be combined with a broad rule exception.

#### Tests and verification

- Resolver slice: `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand` and `pnpm --filter backend architecture:check`.
- Barrel cleanup: the same architecture check, backend type-check, and the existing backend suite; no test imports the removed barrel.
- Parent resumption: architecture check, `pnpm test`, `pnpm run frontend:build`, and `git diff --check`. Existing evidence records 34/34 focused architecture tests and a successful frontend build; the full suite currently has six MySQL-unavailable failures, which are environmental and must remain separately identified.

#### Issue and change relationship

Issue #37 is the approved, now closed umbrella for the verification guardrail parent. Its accepted scope is verification-only and its proposal explicitly excludes production moves/runtime changes. Because this prerequisite includes deleting a production source barrel (and the optional fallback changes production imports), the safest relationship is:

- keep #37 as the parent/context reference;
- create a separate approved remediation issue/change for current-source cleanup and checker correctness;
- link that remediation as blocking the unfinished parent PR 3, without mutating #37 or treating its closed approval as approval for the new production scope.

If maintainers decide the unused-barrel deletion is sufficiently within #37's no-runtime-change intent, the resolver-only slice may be linked directly to #37, but production-scope approval should still be explicit.

#### Non-goals

- Do not add a baseline, suppression file, broad directory allowlist, or permissive unresolved-local fallback.
- Do not amend the application rule to permit arbitrary application-to-application imports merely to retain an unused barrel.
- Do not parse `.astro` internals, add an Astro ESLint/parser stack, or claim dynamic-import coverage.
- Do not move domain, application, infrastructure, database, page, or component files.
- Do not change backend/frontend runtime behavior, APIs, schemas, auth, cart behavior, or CI/package wiring in this prerequisite.
- Do not modify existing parent OpenSpec artifacts, tasks, the runtime ledger, or the dirty local parent implementation.

### Risks

- The private backend package could have an untracked external consumer of the barrel; confirm package publication boundaries before deleting it. Repository-wide source search found no in-repository consumer.
- A resolver fallback that accepts any `.astro`-looking path would recreate the original fail-open problem. It must require an explicit local specifier and an existing file under the repository root.
- Direct page imports, if used as fallback, can preserve behavior only if all five paths are updated and the frontend build remains green; they should not be mixed with an unrelated barrel redesign.
- Parent PR 3 currently has uncommitted production/tooling changes. Prerequisite work must be based on clean `main` and must not absorb those changes into this exploration.
- The full suite's six MySQL connection failures are unrelated environmental noise; they must not be misreported as remediation regressions.

### Ready for Proposal

Yes. The proposal should authorize the narrow resolver correction and unused-barrel cleanup as prerequisite work, require a separate approved issue relationship for production-source scope, and preserve the parent guardrail's fail-closed/no-baseline contract.
