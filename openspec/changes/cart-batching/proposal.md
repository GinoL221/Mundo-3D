# Proposal: Cart Sync Batching

## Intent

Every cart mutation fires its own `PUT /api/cart` immediately (`addToCart`/`removeFromCart`/`clearCart`/`checkout` each call `syncToBackend`). Clicking "add" five times sends five full-state PUTs where only the last matters — the payload is already the complete desired cart, not a delta. The other four are wasted round-trips, wasted DB writes on a Tier 0 path, and extra concurrent PUTs feeding the known server-side commit-order race. P2 tech debt; no user-visible defect today because the store is optimistic.

## Scope

### In Scope
- Trailing-edge debounce in `CartService.ts` coalescing rapid mutations into one PUT.
- Hard max-wait cap so a sustained click stream still reaches the server.
- Forced immediate flush on `checkout()`, `pagehide`, and `visibilitychange → hidden`.
- Flush carries the pre-burst `previousItems` so rollback still targets last-confirmed state.
- New tests asserting fetch call-count for a burst; adapt the 2 stale-response ordering tests to fake timers.

### Out of Scope
- **Server-side commit-order race** in `SequelizeShoppingCartRepository.syncCart` (no version/sequence token). Pre-existing, tracked separately, deliberately untouched here.
- Backend contract, payload shape, delta sync, reconciling GET.
- Guest carts (never hit the backend).
- A "syncing…" UI affordance — see Approach.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `nano-stores-cart`: "Asynchronous, Non-blocking API Synchronization" changes from one request per local change to one request per coalesced burst, plus flush triggers.

## Approach

Debounce the network call only, never the local store. `cart-updated` keeps firing per mutation — it drives the badge, so coalescing it would visibly lag the UI. `cart-sync-error` coalesces as a byproduct (one flush, at most one error), removing error spam without new machinery.

No "syncing…" affordance: confirmation is invisible today too (no success signal exists, only the error event). A spinner would newly surface a background operation for a debt cleanup — a UX regression.

`keepalive: true` and the no-rollback-on-throw catch block are preserved verbatim on every flush.

`syncSeq` stays: debouncing makes overlapping PUTs rarer, not impossible (burst B can start before burst A's response lands).

Exact window/cap values are `sdd-design` decisions; the starting point is a ~300 ms quiet period with a ~1000 ms cap.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/domains/cart/services/CartService.ts` | Modified | Debounce scheduler; flush triggers; pre-burst `previousItems` |
| `frontend/src/domains/cart/services/CartService.test.ts` | Modified | New burst call-count tests; 2 ordering tests move to fake timers |
| `openspec/specs/nano-stores-cart/spec.md` | Modified | Delta spec for coalesced sync |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mutation never reaches the server because the page closed inside the window — the new failure mode this change introduces | High without mitigation | `pagehide` + `visibilitychange → hidden` flush is mandatory, not optional; `beforeunload` is unreliable on mobile and is not used |
| `checkout()` redirects before the empty-cart PUT is scheduled | Med | `checkout()` flushes synchronously before returning |
| Rollback targets the wrong baseline after coalescing | Med | Flush captures `previousItems` from the burst's first mutation |
| Debounce silently breaks the 2 ordering guarantees | Med | Tests adapted with explicit window advancement; guarantee unchanged, only trigger granularity |
| Tier 0 coverage regression | Low | Burst call-count tests are net-new coverage |
| Pre-existing server commit-order race (out of scope) | Med | Unchanged. Fewer concurrent PUTs narrows exposure incidentally — it is not fixed |

## Rollback Plan

Single revert of the change branch. Frontend-only, no schema, no API contract, no persisted format change — revert restores per-mutation sync exactly.

## Dependencies

None. No new package, env var, or backend change.

## Success Criteria

- [ ] N rapid mutations inside one window produce exactly 1 `PUT /api/cart`.
- [ ] Sustained mutations past the cap still sync without waiting for quiet.
- [ ] `checkout()`, `pagehide`, and hidden-tab each force an immediate flush.
- [ ] `keepalive: true` present on every flush; throw path still does not roll back.
- [ ] Both stale-response ordering guarantees still hold.
- [ ] `cart-updated` still fires once per mutation.
- [ ] `pnpm frontend:check` and `pnpm test` green; no Tier 0 coverage drop.
