# P2 — Dead frontend legacy cleanup & 401 redirect race fix

Two independent PRs from `origin/main` (`04aab47`):
- **P2a (`chore/retire-dead-frontend-legacy`):** remove 100%-dead legacy CSS, `WhatsAppFloating.astro`, `crtToggle.ts`, `--lcd-*` tokens, and unreferenced legacy public assets; sync `DESIGN.md` and `design/taller-maker-styleguide.html`.
- **P2b (`fix/auth-401-redirect-race`):** make `frontend/src/lib/http/authFetch.ts` the single source of truth for authenticated `401 → /login` teardown and redirect, removing duplicate caller `clearSession()` / redirects in admin scripts.

## Specs

- **S1 — Remove dead stylesheets and orphaned component (P2a).** Remove `error-pages.css`, `feature-strip.css`, `profile.css`, `carousel.css`, `users-list.css`, `forms.css` (and their 6 imports from `Layout.astro`), plus `whatsapp-floating.css` and `frontend/src/components/WhatsAppFloating.astro`. Keep `alerts.css`, `nav-toggles.css`, and `price.css` untouched. Preserve `header-modules.test.ts` assertions that `Layout.astro` does not import `WhatsAppFloating` or `whatsapp-floating.css`. Verify every active `<form>` (login, register, confirm-email, products search, help commission, admin create/edit) still lays out cleanly without `forms.css`.
- **S2 — Remove `crtToggle.ts` and `--lcd-*` tokens (P2a).** Delete `frontend/src/scripts/crtToggle.ts`, remove `'crtToggle'` from `backend/tools/architecture/config.js`, remove the `initializeCrtToggle` test block from `frontend/src/scripts/header-modules.test.ts` (keeping the no-CRT assertions on `Layout.astro` and `e2e/tests/header.spec.ts`), remove `--lcd-bg` / `--lcd-fg` from `frontend/src/styles/tokens/colors.css` and `design/taller-maker-styleguide.html` (preserving 1:1 mirror), and update `DESIGN.md` so retired items are no longer listed as live debt.
- **S3 — Remove unreferenced legacy public assets (P2a).** Delete only proven unreferenced assets in `frontend/public/`: `images/illustrations/empty-state.{svg,png}`, `images/illustrations/{Busto,Figura,Llavero,Máscara,Otras}.png`, `images/icons/*.png` (6), `img/carousel/*` (9), `img/fondo.jpg`, `img/img1.jpg`..`img20.jpg`, `img/icons8-*.svg` (3), and `favicon.svg`. Never touch `/img/brand/*`, `/img/products/*`, `/img/users/*`, `/images/illustrations/*.svg` (`empty-cart.svg` + 5 category SVGs), `/fonts/*`, or `favicon.ico`.
- **S4 — Single-source-of-truth authenticated `401 → /login` in `authFetch.ts` (P2b).** Capture `hadSession = Boolean(getSessionUser())` before `ensureRefreshed()`; when `!refreshed && hadSession`, OR when the post-refresh retried request still returns `401` while `hadSession` was true, run a single-flight `endSessionAndRedirect()` that: (a) expires `m3d_user` / `m3d_csrf` synchronously (`expireClientReadableSessionCookies()`), (b) broadcasts `logged-out` on `BroadcastChannel('m3d-session')`, (c) fires keepalive `/api/users/logout` + `/api/users/refresh/revoke` once, and (d) redirects once to `/login` (`window.location.assign('/login')` or `.href = '/login'`), guarded by a module-level single-flight flag (resettable in tests) so concurrent `401`s never race or double-teardown. Never redirect guests (`!hadSession`).
- **S5 — Remove duplicate 401 teardown/redirects in admin callers (P2b).** Update `adminProductsForm.ts`, `adminProductsList.ts`, `adminProductsCreate.ts`, `adminProductsEdit.ts`, and `adminCommissionRequests.ts` so `401` responses do not trigger a second `clearSession()` or competing `window.location.assign('/login')`, and `finally` blocks do not re-enable controls mid-redirect on `401`. Update `authFetch.test.ts` (test-first RED → GREEN) and `adminCommissionRequests.test.ts`.

## Tasks

| ID | Specs | Route | Commit |
| --- | --- | --- | --- |
| T1 | S1, S2, S3 | worker in `/tmp/mundo3d-p2a` on `chore/retire-dead-frontend-legacy` | 09dbf16 (PR #261 merged f2ab39a) |
| T2 | S4, S5 | worker in `/tmp/mundo3d-p2b` on `fix/auth-401-redirect-race` | 3c70cad (PR #262 merged) |

## Log

- L1 (user): chose `audit-p2-now`, then after audit chose `run-p2a-and-p2b-split` ("Hacer P2a y P2b en 2 PRs separados (Recomendado)").
- L4: Published and merged with user approval: issue #260 created and approved (`status:approved`), PR #261 (P2a dead legacy cleanup, f2ab39a) and PR #262 (P2b single-flight 401 redirect fix, Closes #260) both passed full CI + real-DB E2E on first attempt and merged into `main`. Main checkout updated via `git pull --ff-only`.
- L3: Both T1 (`09dbf16`, +8/-762 across 62 files) and T2 (`a5b6913`, +322/-82 across 8 files) implemented, committed, and verified locally. T1 verified 1:1 styleguide mirror, `architecture:check`, 420/420 tests, build, and all 6 visible forms `display: grid` at 1440/390. T2 passed independent security verification (`gentle-ai-verify`, Risk: item 2): 3/3 refresh-401, 3/3 retried-401, 5-way concurrent single-flight, guest no-op, cross-tab `BroadcastChannel` `.admin-only` hide, 426/426 tests, `architecture:check`, and build. Both RDD `assess` calls returned `reviewDue: false`.
- L2: P2b touches auth/session termination (`authFetch.ts`) -> `Risk: item 2` (security) requires independent verification (`gentle-ai-verify`) before publishing.
