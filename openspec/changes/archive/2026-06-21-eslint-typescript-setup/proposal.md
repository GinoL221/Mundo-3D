# Proposal: ESLint and TypeScript Integration

## Intent

Upgrade the linting configuration to support TypeScript files in `src/` using modern ESLint flat config, enforcing strict type safety and code quality rules as decided by the team.

## Scope

### In Scope
- Install devDependencies: `typescript-eslint`.
- Update `eslint.config.js` to use typescript-eslint flat config format.
- Enable type-aware linting (`parserOptions.project` pointing to `./tsconfig.json`).
- Enforce `@typescript-eslint/no-explicit-any` as `error`.
- Enforce `@typescript-eslint/no-unused-vars` as `error`, ignoring names starting with underscore (`_req`, `_next`).
- Keep clean separation between ESLint (logic) and Prettier (formatting).
- Resolve all linting violations in the existing codebase.

### Out of Scope
- Code style formatting checks within ESLint (delegated strictly to Prettier).
- Major refactoring of non-type-related business logic.

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Approach

1. Install `typescript-eslint` via npm.
2. Replace `eslint.config.js` with TypeScript config:
   - Use `tseslint.config()` wrapper.
   - Include JS recommended config, TS recommended config, and TS recommended-type-checked config.
   - Configure rule overrides for `no-explicit-any` and `no-unused-vars`.
3. Update `package.json` lint script to support TypeScript files.
4. Run `npm run lint` and remediate any reported violations.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add `typescript-eslint` dependency; update lint script. |
| `eslint.config.js` | Modified | Migrate to typescript-eslint flat config. |
| `src/` | Modified | Adjust files containing `any` or unused variables to pass new rules. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing code violations cause massive build failures | Med | Identify and fix type definitions or unused variables in a structured cleanup pass. |
| Performance overhead from type-aware rules | Low | Restrict lint scanning to `src/` directory. |

## Rollback Plan

Revert git changes for:
- `eslint.config.js`
- `package.json`
- `package-lock.json`
Run `npm install` to restore original devDependencies.

## Dependencies

- typescript (`^6.0.3`) - already installed
- ts-node (`^10.9.2`) - already installed

## Success Criteria

- [ ] `npm run lint` completes with zero errors or warnings on all `.js` and `.ts` files under `src/`.
- [ ] Explicit `any` usages raise linting errors.
- [ ] Unused variables (not prefixed with `_`) raise linting errors.
