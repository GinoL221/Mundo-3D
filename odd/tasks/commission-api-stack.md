# Commission API Stack — ODD

Delivery plan for Task 2 in `odd/tasks/custom-commission-intake.md`, based on `ee94609faa430011ab5d7fdc97dff46a168de2e1`.
Split the combined 645-line API change into stacked, independently verified GET and POST slices; no push, PR, or merge without explicit authorization.

## Specs

S1. `Add public POST with field validation and bounded IP rate limiting.`

S2. `Add protected list API for ADMIN/STAFF only; no public read or mutation endpoint.`

S3. `Document routes in the generated OpenAPI source and cover public, USER, STAFF, ADMIN, validation, rate-limit, and expiry behavior.`

S4. `Focused backend route/security tests, type-check, and OpenAPI checks pass.`

## Tasks

- T1 [S2-S4] Build the protected STAFF/ADMIN GET slice first, including newest-first ordering, OpenAPI, and focused tests; route: `feat/commission-staff-api-on-main`; commit: `ad83954afe7d0a981b54edba9718dda2758e2b07`.
- T2 [S1,S3-S4] Build the public POST slice after T1, preserving validation, per-IP rate limiting, receipt-only response, OpenAPI, and focused tests; route: stacked on T1, then retarget to `main` after merge; commit: pending.
- T3 [S1-S4] Verify each slice, assess risk, obtain independent verification, and request separate user authorization before publishing or merging; route: per-slice PR; commit: not applicable.

## Log

- L1 — User request, verbatim: `Review the delivered subagent output and continue.`
- L2 — User selected delivery strategy, verbatim: `Cadena apilada sobre main (recomendada)`.
- L3 — The current combined API commit is 645 changed lines (`f0310a2` plus `35fe2bd`). The route currently combines public POST and protected STAFF/ADMIN GET; this plan separates those existing behaviors without changing their product contract. Old commission PRs remain untouched.
- L4 — T1 RED was observed before implementation: the GET route/spec were absent (8 expected failures; 42 existing OpenAPI tests passed). A follow-on 404 exposed a test mount-prefix mismatch; the test harness now mounts the root router at `/api/custom-commission-requests`. GREEN: focused route/OpenAPI/security tests passed 67/67; type-check, OpenAPI drift check, architecture check, and backend lint passed. New files are formatted. Full-file Prettier reflow of existing files inflated review scope, so that incidental reflow was reverted; the current slice is 321 changed lines including untracked files. Independent verification is pending. No DB, `.env`, migration, push, or PR.
- L5 — User evidence, verbatim: `Confirmed S3 documentation mismatch: backend/src/infrastructure/routes/api/customCommissionRequests.ts:23 says “Newest unexpired requests”; backend/src/infrastructure/repositories/SequelizeCustomCommissionRequestRepository.ts:38-43 filters expiresAt > now but orders createdAt ASC (line 41). ListCustomCommissionRequestsUseCase.ts:10-11 and controller.ts:9-10 forward unchanged, so actual order oldest-first. Auth/cache source and tests otherwise satisfy T1 scope; runtime checks not run per your instruction.` Resolve by preserving the documented/newest-first contract and adding a regression assertion for repository order; user confirms the independent verifier did not run commands. Old commission PRs remain untouched.
- L6 — Independent verifier re-reviewed after the ordering fix: S2/S3 PASS, S4 parent-reported PASS, and T1 covered by static source/test review. It confirmed newest-first and `no-store`; it did not run commands or refresh Git diff/status/budget. UI loading/error/empty states belong to the later frontend task and are outside T1.
- L7 — Parent ran the corrected regression suite: 5 suites/70 tests passed; backend type-check, OpenAPI drift check, architecture check, and lint passed. `git diff --check` passed and parent measured the current slice at 334 changed lines including new files. No live-DB or migration test was run; tests assert the repository query options. No `.env`, push, or PR. T1 remained pending its local work-unit commit.
- L8 — Local work-unit commit `ad83954afe7d0a981b54edba9718dda2758e2b07` (`feat(commissions): add protected staff request listing`) contains exactly the 13 scoped paths, 329 additions / 5 deletions. Commit hooks passed `pnpm -r lint` and `pnpm --filter frontend quality:check`. Worktree clean; commit remains local and unpushed.
