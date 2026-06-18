# Verification Report

**Change**: api-security-and-admin-guard
**Mode**: Strict TDD
**Re-verification**: Yes — supersedes prior FAIL report (CRITICAL-1 fix independently re-confirmed)

## Completeness
Tasks: 20/20 complete (16 original + 4 post-verify-fix `PV.1`-`PV.4`), confirmed via direct read of `tasks.md` — all checkboxes marked `[x]`, no unchecked items.

## Build & Tests Execution
- `npx tsc --noEmit` → 0 errors (confirms `RegisterUserInput` interface change introduced no type errors anywhere in the codebase).
- `npm test` → **43 suites passed / 43 total**, **243 tests passed + 1 skipped (244 total)**, 0 failed — independently re-run, matches the orchestrator's prior spot-check exactly.
- `npx jest RegisterUserUseCase --verbose` → 5/5 passed in isolation.
- `npx jest authMiddleware apiUsersLogin apiSecurity --verbose` → 3 suites / 37 tests passed (the three files covering the other 3 spec areas), confirming the fix introduced no regression elsewhere.

## Spec Compliance Matrix (13/13 scenarios compliant)

| Spec area | Scenarios | Status | Evidence |
|---|---|---|---|
| api-jwt-auth | 5/5 | COMPLIANT | `authMiddleware.test.js` (11 tests) + `apiUsersLogin.test.js` (3 tests) |
| admin-route-guard | 3/3 | COMPLIANT | `authMiddleware.test.js` + `apiSecurity.test.js` (20 integration tests) |
| user-registration-role | 2/2 | COMPLIANT (was 0/2 — FIXED) | `RegisterUserUseCase.test.ts` (5 tests, 2 directly covering both scenarios) |
| visual-admin-hiding | 3/3 | COMPLIANT | `apiSecurity.test.js` EJS-gating assertions on `header.ejs` and `users.ejs` |

### user-registration-role — fix independently re-confirmed

Read `src/application/use-cases/RegisterUserUseCase.ts` directly:
- `RegisterUserInput` interface (lines 7-14) no longer declares `IDRole`/`Category` at all.
- `execute()` (lines 37-46) constructs the `User` entity with hardcoded literals `2` and `'User'` — unconditional, not a default-if-undefined pattern. There is no code path through which a caller-supplied role can reach the entity.

Read `src/application/__tests__/RegisterUserUseCase.test.ts` directly:
- Test 1 ("...defaulting to the standard role") sends no role fields and asserts `IDRole: 2`/`Category: 'User'` in both the repo `create()` call and the returned DTO.
- Test 2 ("should ignore an attacker-supplied administrative role...") deliberately casts `{ ..., IDRole: 1, Category: 'Admin' } as RegisterUserInput` to bypass the type system and assert the persisted/returned values are still `2`/`'User'` — this directly covers spec scenario "Role modification is ignored during public registration" and cannot be satisfied by accident (TypeScript stripping fields), since the cast forces the fields through at runtime regardless of the interface shape.
- Both scenarios in `specs/user-registration-role/spec.md` (Default User Role Assignment, Role modification is ignored) are now covered by passing runtime tests, not just type-level omission.

Grepped every caller of `RegisterUserUseCase`/`RegisterUserInput` in `src/` (outside tests): `userRoutes.ts`, `UserController.ts`, legacy `controllers/users/logout.ts`/`postNewUser.ts`/`processLogin.ts` composition wrappers. The only real call site building the input object is `UserController.ts:114-120`, which destructures only `firstName/lastName/email/password` from `req.body` — it never reads or forwards `IDRole`/`Category`. No caller anywhere depends on the removed interface fields, and `npx tsc --noEmit` confirms zero compile errors from the interface change.

## Correctness — other 3 spec areas re-confirmed, no regression
`IDRole`/`Category` on User model (default 2/'User'), admin seed (`IDRole:1`/`'Admin'`), `apiAuthMiddleware`, `adminGuard` (dual web/API), `POST /api/users/login` issuing JWT, `apiAuthMiddleware` mounted on `/api/users` routes, `adminGuard` on product mutation routes (`productCart` correctly kept on `isUser`), `adminGuard` on `DELETE /users/delete/:id`, `IDRole`/`Category` copied into session on login, EJS gating in `header.ejs`/`users.ejs` — all re-confirmed via direct source read and passing tests. No code outside `RegisterUserUseCase.ts`/`.test.ts` changed since the prior verify run, so no new regression surface was introduced.

## Assertion Quality
All test files (`authMiddleware.test.js`, `apiUsersLogin.test.js`, `apiSecurity.test.js`, `RegisterUserUseCase.test.ts`) verify real behavior — no tautologies, no ghost loops, no smoke-test-only patterns. The attacker-role test in particular is well-designed: it forces a type-unsafe input through a cast specifically to prove the use case enforces the rule independently of TypeScript, rather than relying on the interface shape to "accidentally" prevent the attack.

## Issues

### CRITICAL
None. The previously reported CRITICAL-1 (`user-registration-role` enforcement was accidental and untested) is resolved: enforcement is now explicit, unconditional, and covered by a runtime test that cannot pass without the fix.

### WARNING (re-assessed, not escalated)
1. **Guest mutation requests get 403 from CSRF before reaching `adminGuard`** — for `POST`/`PUT`/`DELETE` requests to admin routes, global CSRF middleware (mounted ahead of routing) rejects unauthenticated requests with 403 before `adminGuard` runs, rather than the literal "redirect to `/login`" the spec describes for guest users on all verbs. Re-checked: net security outcome is correct (guest is blocked, cannot reach the admin controller), this is a defense-in-depth ordering, not a bypass. Decision: leave as WARNING, not blocking. Elevating to CRITICAL would require the actual behavior to violate the security guarantee (it doesn't) — only the documented redirect mechanism differs from realized behavior for non-GET verbs. Recommend a follow-up spec wording tweak (not a code change) in a future change, scoped out of this one.
2. **No ESLint coverage for `.ts` files** — confirmed via direct read of `eslint.config.js`: no `files: ["**/*.ts"]` block, no `@typescript-eslint` parser/plugin configured project-wide. `src/application/**/*.ts` and `src/infrastructure/**/*.ts` (including the very files modified in this change) get zero lint coverage. Re-checked: this is pre-existing and applies to the entire codebase, not introduced or worsened by this change. Decision: leave as WARNING, out of scope for this change — fixing it is a separate, codebase-wide tooling change with its own risk/effort profile.

### SUGGESTION
1. (Resolved by this fix, kept for historical traceability) Previously suggested adding an explicit regression test for a role-override attempt — now implemented as `RegisterUserUseCase.test.ts`'s second test.
2. Consider adding a one-line code comment in `SequelizeUserRepository.create()` noting that omitting `IDRole`/`Category` from the forwarded Sequelize payload is now intentionally redundant with the use case's hardcoded default (not load-bearing, but improves future-maintainer clarity given the history of this exact field being a near-miss vulnerability).

## Verdict
**PASS WITH WARNINGS** — 0 CRITICAL, 2 WARNING (both pre-existing/non-blocking, re-assessed and not elevated), 2 SUGGESTION. All 13/13 spec scenarios across all 4 spec areas are compliant with passing runtime test evidence. 20/20 tasks complete. Zero regressions confirmed via independent re-run of the full suite plus targeted isolation runs.

## Next Steps
Recommend `sdd-archive`. No further fixes required before archiving this change.

Report files: `openspec/changes/api-security-and-admin-guard/verify-report.md` (this file) and engram observation `sdd/api-security-and-admin-guard/verify-report` (topic_key upsert, supersedes id #802's FAIL content).
