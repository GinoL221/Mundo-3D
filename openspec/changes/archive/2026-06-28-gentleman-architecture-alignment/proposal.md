# Proposal: Gentleman Architecture Alignment

## Intent
Align Mundo-3D codebase with Gentleman Programming principles by introducing clean modular folders, type-safe adapters, centralizing state/synchronization, and replacing unsafe DOM manipulation with Astro templates.

## Scope
| In Scope | Out of Scope |
| :--- | :--- |
| Create `index.ts` barrel files for backend & frontend. | Database schema changes. |
| Reorganize frontend into `domains/` (`auth`, `products`, `cart`). | Redesigning UI styling or visual elements. |
| Implement client-side `CartService` to encapsulate `localStorage`. | Refactoring backend business logic. |
| Add type-safe API adapters to map raw schemas to client models. | Modifying deployment pipelines. |
| Replace raw client-side `innerHTML` with Astro `<template>` tags. | Adding third-party CSS frameworks. |
| Standardize explicit, user-friendly error displays in the UI. | |

## Capabilities
- **New**: None
- **Modified**: None

## Approach
Implement "Wrapper Pages with Domain Delegation" (Approach A):
1. **Directory Restructuring**: Group related components, pages, adapters, and services into `src/domains/<domain>/`. Keep routing files in `src/pages/` as thin wrappers.
2. **Barrel Exports**: Add `index.ts` files for backend layers (`entities`, `ports`, `use-cases`) and frontend (`components`, `store`).
3. **Data Transformation**: Build adapters converting backend response types (e.g. `idProduct`) to clean client interfaces (e.g. `id`).
4. **State & Storage**: Centralize state logic in a new `CartService` encapsulating `localStorage`.
5. **Secure UI Rendering**: Swap innerHTML-based client injection with cloneable Astro templates and `textContent` to prevent XSS.

## Affected Areas
- `backend/src/domain/`, `backend/src/application/`
- `frontend/src/pages/`, `frontend/src/store/`, `frontend/src/components/`
- `frontend/src/domains/` (New directory structure)

## Risks & Mitigation
- **TypeScript Strictness**: Strict linting rules against `any` and unused variables.
  - *Mitigation*: Declare explicit interfaces for all API payloads and use precise type guards.
- **Import Path Breakage**: Relative paths will shift due to relocation.
  - *Mitigation*: Run linter and type-checking compiler immediately post-relocation.
- **XSS & Template Quirks**: Client-side template cloning issues.
  - *Mitigation*: Verify DOM manipulation operations and run E2E/component tests.

## Rollback Plan
Perform a git rollback of the change branch:
`git checkout main && git branch -D gentleman-architecture-alignment`

## Dependencies
- Standard Astro file-based routing.
- Existing ESLint/TypeScript configurations.

## Success Criteria
- [ ] Code compiles with zero TypeScript errors or ESLint violations (`any`, unused variables).
- [ ] No occurrences of `innerHTML` or raw API structures in frontend templates.
- [ ] Cart state synchronizes correctly with `localStorage` via `CartService`.
- [ ] Unit and E2E tests pass successfully.
