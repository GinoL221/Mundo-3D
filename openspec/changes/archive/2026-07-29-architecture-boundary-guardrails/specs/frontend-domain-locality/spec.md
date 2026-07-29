# Delta for Frontend Domain Locality

## ADDED Requirements

### Requirement: TypeScript Domains Remain Local

Each frontend TypeScript domain module MUST be allowed to use its own domain files, approved shared configuration, and external packages. It MUST NOT import another domain, a page, layout, shared component, or backend module.

#### Scenario: Domain-local dependency is accepted

- GIVEN a TypeScript module under a frontend domain imports its own module, approved shared config, or an external package
- WHEN the architecture check resolves the dependency
- THEN the dependency passes without a locality violation

#### Scenario: Cross-boundary domain dependency is rejected

- GIVEN a frontend domain module imports another domain, page, layout, shared component, or backend source
- WHEN the architecture check runs
- THEN it fails and identifies the source, target, and violated frontend locality rule

### Requirement: Astro Composition Scope Is Explicit

Current `.astro` files MUST be treated as documented composition surfaces, not as internally parsed TypeScript domains. The check MUST continue to enforce TypeScript domain imports and MUST NOT imply coverage of `.astro` frontmatter, scripts, or dynamic loading.

#### Scenario: Astro composition remains outside this parser scope

- GIVEN an allowed page or shell `.astro` surface composes multiple frontend domains
- WHEN the architecture check runs
- THEN the surface is not rejected for its internal composition and the limitation remains documented

#### Scenario: TypeScript domain still cannot import presentation code

- GIVEN a frontend domain TypeScript module imports a page, layout, component, or backend module
- WHEN the architecture check resolves the static dependency
- THEN it fails even though `.astro` internals are outside the checked scope
