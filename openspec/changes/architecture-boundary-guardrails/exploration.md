## Exploration: architecture-boundary-guardrails

### Current State

Mundo-3D has a mixed CommonJS/TypeScript Express backend and an Astro frontend. The backend has recognizable `domain`, `application`, `infrastructure`, and `database` areas; the frontend has `auth`, `cart`, and `products` domain modules. The current dependency direction is mostly correct, but it is enforced by convention and tests rather than by a resolved-import guardrail.

#### Backend boundary map

| Source area | Observed dependencies | Assessment |
|---|---|---|
| `backend/src/domain/` | Entities import other entities/exceptions; ports import entities. No imports of Express, Sequelize, database, infrastructure, filesystem, or UI code were found. | Compliant core. This is the highest-value protected boundary. |
| `backend/src/application/` | Use cases import domain ports/entities/exceptions and application DTOs. No production imports of infrastructure, database, Express, Sequelize, or filesystem code were found. | Compliant and suitable for an immediate hard rule. |
| `backend/src/infrastructure/controllers/` | Controllers import Express types, application use cases, and infrastructure file cleanup. | Compliant adapter/controller direction. |
| `backend/src/infrastructure/repositories/` | Sequelize repositories import `sequelize`, `database/models/db`, domain entities, and domain ports. | Compliant adapter direction; database access is intentionally isolated here. |
| `backend/src/infrastructure/routes/api/` | Route modules import Express, concrete Sequelize repositories, use cases, controllers, middleware, and domain role values. `products.ts:21-40` instantiates repositories and use cases at module scope. | Intended composition-root behavior, but currently distributed across route modules. Must be an explicit narrow exception, not a general infrastructure permission. |
| `backend/src/database/` | Models and migration/bootstrap scripts import Sequelize, Umzug, MySQL, filesystem, dotenv, and local database modules. | Compliant infrastructure boundary. Database code must not import domain/application/infrastructure production code. |
| `backend/index.js` and `backend/src/app.js` | Startup imports dotenv/database/bootstrap; app imports Express, middleware, and API routes. | Intended composition roots. They cannot be judged by the same inward-only rule as domain/application. |

Concrete compliant examples:

- `backend/src/application/use-cases/ListProductsUseCase.ts:1` imports `ProductRepositoryPort`, not `SequelizeProductRepository`.
- `backend/src/infrastructure/repositories/SequelizeProductRepository.ts:1-6` imports Sequelize/database implementations and domain contracts as an adapter.
- `backend/src/domain/entities/Product.ts:1-2` imports only domain entities.

Current benign or ambiguous imports that must not be reported as violations:

- `backend/src/infrastructure/routes/api/products.ts:2-10` imports concrete repositories and use cases to compose a request pipeline.
- `backend/src/infrastructure/repositories/SequelizeProductRepository.ts:6` imports `database/models/db`; this is the adapter's intended outward dependency.
- Infrastructure tests import Express, Sequelize, database models, and route modules to exercise those boundaries.
- `backend/src/app.js:18-24` and `backend/index.js:3,11-22` are startup composition code.

No true production violation was found in the backend domain/application direction on this branch. The guardrail must therefore start with immediate hard-fail rules rather than a broad violation baseline. If implementation discovers an unresolved edge, it should classify it explicitly instead of adding a blanket baseline.

#### Frontend boundary map

The frontend has no ESLint configuration or lint script. `frontend/package.json` exposes Astro build and Vitest only. There are no configured TypeScript path aliases in `frontend/tsconfig.json`; imports are predominantly relative.

| Source area | Observed dependencies | Assessment |
|---|---|---|
| `frontend/src/domains/auth/` | Own adapter/services/components and shared `config.ts`. | No imports of pages, layouts, shared shell, or another domain were found. |
| `frontend/src/domains/cart/` | Own service/component, `nanostores`, and shared `config.ts`. | Compliant feature-local module. |
| `frontend/src/domains/products/` | Own adapter/service/component and shared `config.ts`. | Compliant feature-local module. |
| `frontend/src/pages/` | Imports `Layout` and domain public barrels. `product.astro` composes `products` and `cart`; admin pages compose `auth` and `products`. | Intended page composition; explicit exception. Astro page scripts also orchestrate DOM and API behavior, but that is outside this boundary change. |
| `frontend/src/components/Header.astro` and `frontend/src/scripts/` | Header imports shell scripts; `sessionUI.ts` imports auth and cart services; `cartBadge.ts` imports cart. | Shared-shell composition, not a domain-to-domain dependency. Allow only from shell/script entry points. |

Concrete frontend examples:

- `frontend/src/pages/product.astro:54-56` composes product mapping and cart behavior.
- `frontend/src/pages/admin/products/index.astro:76-78` composes auth and product admin capabilities.
- `frontend/src/domains/auth/services/auth.service.ts:1-3` stays inside auth plus shared configuration.

No true frontend domain-to-domain or domain-to-page violation was found. The main ambiguity is whether shared scripts remain shell composition or become an unbounded shared layer; the first guardrail should allow the current narrow paths without promoting more code.

#### Tooling compatibility

- Backend ESLint is flat-config ESLint 10 with `typescript-eslint`; it runs against `src/` only and uses `sourceType: "commonjs"`. Frontend files, root `backend/index.js`, and several config/script surfaces are not currently linted.
- Core `no-restricted-imports` can cheaply forbid stable package names and import patterns in backend domain/application files. It does not resolve relative imports to architectural areas, is awkward for layer-specific relative paths, and must not be treated as complete coverage for ordinary CommonJS `require()` calls. TypeScript `import = require()` support also has documented option limitations.
- `eslint-plugin-boundaries` can express element types and dependency policies in flat config, but adding it would require a frontend ESLint/parser setup to cover Astro. It still creates a second boundary vocabulary alongside the existing backend config.
- `dependency-cruiser` supports ES imports, CommonJS requires, TypeScript, forbidden path rules, and `tsconfig` path resolution. It is the strongest off-the-shelf graph option for backend and TypeScript files, but it adds a dependency/configuration surface and does not remove the Astro parsing/entry-point decision.
- A focused checker can reuse the already-installed backend TypeScript compiler and Jest. It can parse TypeScript and JavaScript ASTs, extract imports/exports and static `require()` calls, resolve local modules with each package's `tsconfig`, and classify the resolved file. `.astro` files should be treated as explicit composition surfaces in the first slice rather than parsed by a new Astro ESLint/parser stack.

### Affected Areas

- `backend/eslint.config.js` — possible coarse package restrictions; not sufficient as the sole architecture mechanism.
- `backend/src/domain/` — protected domain source set; currently clean and should fail on outward framework/infrastructure imports.
- `backend/src/application/` — protected use-case source set; currently depends on ports and should fail on concrete infrastructure/database imports.
- `backend/src/infrastructure/routes/api/` — composition-root exception set; current concrete wiring must remain allowed narrowly.
- `backend/src/infrastructure/repositories/` and `backend/src/database/` — adapter/database classifications and representative allowed edges.
- `backend/index.js` and `backend/src/app.js` — startup composition exceptions and CommonJS `require()` coverage.
- `frontend/src/domains/{auth,cart,products}/` — feature-local source set to protect from cross-domain, page, layout, and UI imports.
- `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/layouts/`, and `frontend/src/scripts/` — explicit presentation/composition surfaces; Astro parsing should remain out of the first checker scope.
- `backend/src/architecture/` (likely new) — resolved-import checker, fixtures, and tests; reuse TypeScript/Jest rather than adding a graph dependency initially.
- `backend/package.json`, root `package.json`, and `.github/workflows/ci.yml` — expose and execute a standalone architecture check without depending on the pending verification-baseline change.

### Approaches

1. **Focused TypeScript AST/resolver checker (recommended)** — add a small executable checker that analyzes backend `.ts/.js` and frontend domain `.ts` files, resolves local imports, classifies layers/features, and tests representative allowed/forbidden fixtures.
   - Pros: reuses TypeScript, handles both TS and CommonJS static imports, provides resolved semantics instead of source regexes, supports current relative paths and future `tsconfig` aliases, and keeps Astro as an explicit composition boundary.
   - Cons: a small custom rule engine must be maintained; dynamic imports and arbitrary runtime `require()` cannot be proven statically; Astro page internals are not checked initially.
   - Effort: Medium.

2. **ESLint `no-restricted-imports` only** — add per-directory flat-config overrides for forbidden packages and raw import patterns.
   - Pros: no new dependency, fast feedback, familiar ESLint output, and useful for domain bans such as Express/Sequelize/filesystem packages.
   - Cons: raw specifiers are not resolved, relative path rules are brittle, CommonJS coverage is incomplete, frontend/Astro is currently outside ESLint, and composition exceptions become difficult to express without broad exclusions.
   - Effort: Low initially, Medium once exceptions and mixed modules are covered.

3. **`eslint-plugin-boundaries`** — introduce element definitions for backend layers and frontend domains, then add dependency policies.
   - Pros: declarative layer/feature policies, good diagnostics, and a direct fit for Screaming Architecture concepts.
   - Cons: requires plugin/config adoption, frontend ESLint plus Astro parser decisions, and careful treatment of tests, scripts, aliases, and composition roots. It is more infrastructure than the current clean baseline requires.
   - Effort: Medium/High.

4. **`dependency-cruiser`** — add a resolved dependency graph with forbidden rules and optional cycle checks.
   - Pros: mature graph-oriented semantics, CommonJS/TypeScript support, `tsconfig` path resolution, and strong reporting for path-level rules.
   - Cons: new dependency and configuration, likely separate handling for Astro, more generated/reporting surface than this bounded change needs, and a risk of enforcing the current folder layout rather than business boundaries.
   - Effort: Medium.

### Recommendation

Use **Approach 1** for one bounded backend/frontend guardrail change. Reuse TypeScript's AST and module resolver plus the existing backend Jest runner; do not add `dependency-cruiser`, `eslint-plugin-boundaries`, or a frontend ESLint stack yet. This is the smallest mechanism that can enforce resolved dependency direction across the mixed backend without relying on regex-over-source tests.

#### Candidate rules

1. `domain -> infrastructure/database/framework/IO/UI`: MUST be rejected. Domain may depend on domain entities, ports, exceptions, and standard language types only.
2. `application -> concrete infrastructure/database/framework/IO/UI`: MUST be rejected. Application may depend on domain ports/entities/exceptions and application DTOs, never concrete adapters.
3. `database -> domain/application/infrastructure`: MUST be rejected for production files.
4. `frontend domain -> other frontend domain/pages/layouts/shared UI/backend`: MUST be rejected. Shared `config.ts` and external libraries remain allowed.
5. `infrastructure adapters -> domain/application/database`: MUST be allowed where the adapter role requires it; this includes Sequelize repositories and Express controllers.
6. `composition roots -> concrete adapters`: MUST be allowed only for `backend/index.js`, `backend/src/app.js`, `backend/src/infrastructure/routes/api/**`, and the current frontend page/shell surfaces. The exception list must be path-specific and documented.
7. Tests, migration scripts, E2E, and tool/config files MUST be classified separately. Test-only imports are not production architecture evidence and must not create a false baseline.

#### Adoption and verification

- Run the checker against production backend `.ts/.js` and frontend domain `.ts` files. Include static `require()` and import/export declarations through AST parsing; do not use regex source tests.
- Use fixtures for domain-to-port (green), application-to-port (green), route-to-concrete-repository (green), domain-to-infrastructure (red), application-to-database (red), CommonJS outward require (red), and frontend-domain-to-other-domain (red).
- Add tests proving unresolved local modules fail with a useful diagnostic, while external packages and explicitly allowed `.astro` composition imports do not fail.
- Start with immediate hard failure because the inspected production core has no known true violations. Do not baseline the known composition imports; encode them as narrow exceptions. If unsupported Astro or dynamic-loading cases appear, report them explicitly rather than silently allowing all unresolved imports.
- Run the architecture check as its own command. It must be runnable through the current workspace independently of the pending CI/test-baseline change. A minimal existing-CI invocation may be added, but it must not rely on new jobs, coverage, or type-check gates from that other change.
- Behavior-level regression evidence remains the existing backend/frontend tests and Astro build; the guardrail tests prove the checker, not product behavior. The guardrail change must not move production files or alter runtime behavior.

#### Scope and review forecast

The backend and frontend can remain one bounded change if the implementation limits itself to the checker, fixtures/tests, command wiring, and one CI invocation: approximately **180–320 authored changed lines**, with no production relocation. This is below the 400-line budget, so chained PRs are not recommended. Split backend and frontend only if Astro parsing, a new ESLint stack, or a graph dependency becomes necessary; that would be a different, higher-complexity change.

Exact first-change scope:

- Add resolved-import rules for backend domain/application/database and frontend TypeScript domains.
- Add narrow composition-root exceptions for current route/startup/page/shell surfaces.
- Add fixture-based red/green tests, including CommonJS and unresolved-import behavior.
- Add a standalone command and execute it independently from the verification baseline.

Non-goals:

- No folder moves, barrel-file redesign, feature-wide rewrite, or new package boundaries.
- No Astro parser/ESLint migration, dynamic-import analysis, or universal UI component dependency policy.
- No cart, authentication, database schema, API, or product behavior changes.
- No global coverage target or replacement of the pending verification-baseline-and-ci-gates change.

The change requires no product decision. It does require implementation-level confirmation of the exact unresolved-import policy and whether the existing CI workflow should receive a minimal standalone step or only the command for the next CI-gates change.

### Risks

- A path-only rule could encode today's technical folders instead of meaningful business boundaries; classification should protect only domain/application/feature invariants and keep composition exceptions explicit.
- CommonJS `require()` and TypeScript-to-JavaScript resolution can produce false negatives if the checker inspects only ESM import declarations. Representative CommonJS fixtures are mandatory.
- Astro files contain frontmatter and client scripts that are not ordinary TypeScript modules. Parsing them in this change would expand scope; excluding them must be documented and limited to composition surfaces.
- Future aliases are not configured today. The checker should read `tsconfig` resolution options, but alias behavior still needs a fixture when aliases are introduced.
- Tests and scripts intentionally cross boundaries. Scanning them as production modules would create false positives and encourage broad exemptions.
- The pending `verification-baseline-and-ci-gates` change is not present in this worktree. This change cannot assume its type-check, frontend validation, coverage, or CI restructuring; its own command and tests must work with the current repository.
- Distributed route composition is currently valid but may grow into accidental service-locator behavior. The guardrail should allow the existing narrow roots without treating every infrastructure file as a composition root.

### Ready for Proposal

Yes. The first proposal should target the focused TypeScript AST/resolver checker, fixture-based guardrail tests, standalone command, and narrow current composition exceptions. It should explicitly state that the implementation is independent of `verification-baseline-and-ci-gates`, does not parse or lint Astro internals, and does not move production files.
