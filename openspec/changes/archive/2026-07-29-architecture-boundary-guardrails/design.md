# Design: Executable Architecture Boundary Guardrails

## Technical Approach

Add a CommonJS checker under `backend/tools/architecture`, using TypeScript 6.0.3 and Jest 30.4.2. It analyzes backend `.js/.ts` and frontend `.ts`, never `.astro`. `ts.readConfigFile` + `ts.parseJsonConfigFileContent` load options; `ts.resolveModuleName` with `ts.sys` handles extensions, indexes, `baseUrl`, `paths`, and packages. Outside-package files remain local; `node_modules` is external; outside-repository and relative/absolute/alias failures fail closed. Bare unresolved packages remain external. `.astro` targets use existence-only diagnostics.

AST extraction uses `ts.createSourceFile` and guards for `ImportDeclaration`, `ExportDeclaration`, `ImportEqualsDeclaration` with a string, and `require("...")`/no-substitution-template calls; type-only edges count. Dynamic `import()`, interpolated templates, variable `require`, `module.require`, `require.resolve`, and runtime loaders are unsupported and documented.

## Architecture Decisions

| Decision | Choice and rationale |
|---|---|
| Checker | Custom AST/resolver engine: existing toolchain, mixed CommonJS/TS, no frontend parser stack. |
| Scope | Package manifests plus exact exceptions: hard-fail production and reviewed new roots. |
| Astro | Manifest-only validation: preserves the limitation without runtime scope. |

## Data Flow

`discover → AST → resolve → classify → rules → diagnostics → exit`

## Interfaces / Contracts

```js
Edge: { source, line, column, kind, specifier, classification, resolvedTarget }
Violation: { source, targetOrSpecifier, rule, message }
```

Diagnostics sort by source/position/rule; output includes source, target/specifier, rule; configuration/unavailable errors are non-zero.

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/tools/architecture/config.js` | Create | Roots/manifests. |
| `backend/tools/architecture/ast.js` | Create | Extraction. |
| `backend/tools/architecture/engine.js` | Create | Resolution/classification/rules. |
| `backend/tools/architecture/check.js` | Create | CLI. |
| `backend/src/architecture/__tests__/architecture-boundaries.test.js` | Create | Data-driven tests. |
| `backend/package.json` | Modify | `architecture:check`: `node tools/architecture/check.js`. |
| `.github/workflows/ci.yml` | Modify | Blocking step after install. |

Exceptions: `backend/index.js`, `backend/src/app.js`, `backend/src/infrastructure/routes/api/{index,products,users,cart,categories,franchises}.ts`; scripts `frontend/src/scripts/{sessionUI,cartBadge,crtToggle,themeToggle}.ts`. Astro manifest lists `frontend/src/pages/{index,products,product,cart,login,register,aboutUs,help,faq,privacy,terms,step-by-step}.astro`, `pages/admin/products/{index,create,edit}.astro`, `layouts/Layout.astro`, `components/{Header,Footer,Welcome}.astro`, `domains/auth/components/{LoginForm,RegisterForm}.astro`, `domains/cart/components/CartList.astro`, `domains/products/components/ProductCard.astro`. Set equality rejects unreviewed additions/removals.

## Rule Matrix

| Source | Allowed | Forbidden rule |
|---|---|---|
| Backend domain | Domain entities/ports/exceptions, standard types, non-I/O externals | Infrastructure/database/framework/UI/I/O: `backend.domain.inward` |
| Backend application | Domain contracts/exceptions and `application/dtos` | Concrete adapters/database/framework/I/O/UI: `backend.application.contracts` |
| Backend database | Own subtree, ORM/config, externals | Production domain/application/infrastructure: `backend.database.isolation` |
| Backend infrastructure | Domain/application/database edges | Cross-package; composition edges require allowlist: `composition.allowlist` |
| Frontend domain | Same domain, `src/config.ts`, externals | Other domains/pages/layouts/components/backend: `frontend.domain.locality` |
| Non-production classes | `__tests__`/`.test.*` = test; `database/migrations` = migration; tools/scripts = tool; package/tsconfig/ESLint/CI = config; resolution only | Unresolved local: `resolution.local` |

Built-ins/framework/I/O packages are separate external classes; externals never excuse local failure.

## Testing Strategy

Temp trees cover TS/JS, extension/index, aliases, `.astro`, external, test, migration, tool, config. Tables cover edges, ESM/CommonJS, unresolved locals, externals, allowlists, diagnostics; discovery never scans them. TDD: RED AST/resolution, RED rules, GREEN engine, then CLI/CI. Commands: `pnpm --filter backend exec jest src/architecture/__tests__/architecture-boundaries.test.js --runInBand`; `pnpm --filter backend architecture:check`; `pnpm test`; `pnpm run frontend:build`; `git diff --check`. Proof: `git diff --name-only` may list only tool/test/package/CI/design paths; test/build stay green.

## Threat Matrix

| Boundary | Status and response |
|---|---|
| Documentation-like paths | Applicable: discover only `.js/.ts`; RED cases for `requirements.txt`, `CMakeLists.txt`, executable Markdown/MDX, and `README.sh` prove no execution/false edge. |
| Git repository selection | N/A — fixed repository/package paths; no `git -C` or selector. |
| Commit state | N/A — checker never reads the index or staged state. |
| Push state | N/A — no push/ref resolution. |
| PR commands | N/A — CI invokes one fixed package command; no PR automation. |

## Migration / Rollout

No migration. Independent of `verification-baseline-and-ci-gates`, with no suppressions. No runtime/source/schema/auth/cart/product changes. Rollback removes tool files, test, script, and CI step.

## Requirement-to-Design Traceability

S1–S25 follow spec order.

| Requirement | Scenarios covered |
|---|---|
| R1 Domain inward | S1 green contract; S2 outward red |
| R2 Application contracts | S3 green port; S4 concrete red |
| R3 Database isolation | S5 ORM green; S6 inward red |
| R4 Backend forms/classes | S7 CommonJS red; S8 non-production green |
| R5 Frontend locality | S9 local/config/external green; S10 cross-boundary red |
| R6 Astro scope | S11 unparsed composition; S12 TS-to-presentation red |
| R7 Resolution | S13 unresolved red; S14 external green; S15 ESM/CJS; S16 non-production |
| R8 Composition allowlist | S17 listed green; S18 sibling red; S19 Astro limitation |
| R9 Evidence | S20 fixture matrix; S21 diagnostic fields |
| R10 Independent gate | S22 success; S23 failure/unavailable; S24 baseline independence; S25 rollback/no runtime change |

## Work Units and Forecast

Review units: (1) AST/resolution plus RED fixtures; (2) rules/manifests plus matrix; (3) CLI/package/CI proof. Forecast: 330–390 authored implementation lines (each tool file under 250; tests exempt), plus this design artifact; 400-line risk Low, chained PRs not recommended. No commits.

## Open Questions

None. Decision needed before apply: No.
