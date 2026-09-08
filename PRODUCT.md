# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: technical evaluators.** Recruiters, hiring managers, and engineers who open this project to judge how its author builds. They arrive from a CV, a repository link, or a conversation, and they are deciding something about the author, not buying a figurine. They skim, they poke at edges, and they leave quickly if nothing earns more attention. What they are actually doing is looking for evidence of judgement.

**Secondary: the shopper the storefront serves.** Someone browsing 3D-printed collectibles, or commissioning a custom piece. This persona is not currently transacting with real money, but the storefront must behave as if they were — an evaluator reads a hollow flow as a hollow project. Every buyer-facing decision is made honestly, then judged by the primary user.

The two audiences are not in conflict, but the primary one decides ties.

## Product Purpose

Mundo-3D is a portfolio piece in the form of a working e-commerce for 3D-printed products: pre-made collectibles from known franchises, and custom commissions.

It exists to demonstrate engineering and design judgement through something complete rather than described. Success is an evaluator concluding that the author builds carefully — not a sales figure. That makes the interface itself part of the deliverable rather than packaging around it: a well-argued architecture behind a careless surface reads as an unfinished project, because the surface is the only part most evaluators will ever run.

## Positioning

What a neighbouring project could not truthfully copy is the depth behind the storefront. This is not a template with seeded rows: session handling, refresh-token rotation with reuse detection, CSRF, role separation, real-database integration tests, and a documented specification trail are all present and verifiable in the repository.

The product's claim is therefore not "an online store" but **a storefront whose insides survive inspection**. The design's job is to make that claim legible to someone who has not read the code, and never to contradict it.

## Operating Context

Evaluation happens on a laptop, in minutes, often with several tabs of other candidates open. It usually starts at the home page or a repository README, rarely follows a guided path, and frequently includes logging in to see what the authenticated and administrative surfaces look like. Mobile viewing is plausible but secondary to that first desktop pass.

The shopping context the storefront depicts is ordinary consumer browsing: catalogue, product detail, cart, checkout intent, and order history.

## Capabilities and Constraints

**Working today** (verified in the repository, not aspirational):

- Catalogue with categories and franchises; product detail pages.
- Registration and login with JWT in an `httpOnly` cookie, signed double-submit CSRF, refresh-token rotation with family-wide reuse detection, and per-IP plus per-account login throttling.
- Three-role model: `ADMIN` (1), `USER` (2), `STAFF` (3). STAFF can create and update products but not delete them.
- Product administration with stock and images; category, franchise, and user administration.
- Local cart with Nanostores, synchronised to the API for authenticated users.
- Orders and order history.
- Informational pages: about, FAQ, help, step-by-step, terms, privacy.
- Light/dark theme.
- 17 frontend routes; four frontend domains (`auth`, `cart`, `orders`, `products`).

**Technical constraints:**

- Astro frontend, Express/TypeScript backend in hexagonal layers, Sequelize over MySQL/MariaDB, pnpm workspace monorepo.
- Architecture rule `frontend.domain.locality`: a file under `frontend/src/domains/**` may import only from its own domain or from `frontend/src/config.ts`.
- 250-line cap per source file (tests exempt).
- CSS has no build step; tokens live in `frontend/src/styles/tokens/` and are consumed by component stylesheets.
- Helmet CSP is explicit and stricter than defaults; no inline scripts in backend-served HTML.

**Open product decisions:**

- **Custom commissions are confirmed as part of the product but do not exist in code.** The catalogue is entirely pre-made franchise pieces; there is no upload, quoting, or commission-tracking flow. Both paths must be served: buy from the catalogue, or commission a piece. The home page leads with the catalogue; commissions appear after that as a banner or featured section, not as the primary hero.
- Payment is not implemented. No real transaction occurs. Future work must not imply that one does.

## Brand Commitments

- **Name:** Mundo 3D.
- **Voice:** Rioplatense Spanish, informal second person (_vos_). Present throughout the existing copy ("Recibí tu pedido", "Estamos para vos"). Binding.
- **The franchise catalogue is the business,** not placeholder data. Mario, Captain America, Batman, Iron Man, Joker, Spider-Man, Sonic. Confirmed as non-negotiable.
- **The home page leads with the catalogue.** Custom commissions follow as a secondary banner or featured section. Binding.
- **The three-role model is non-negotiable**, including STAFF's deliberate inability to delete products. It reflects how the product is meant to be operated.

**Visual identity:** brand authority is `docs/diseno/manual-identidad.md` (v0.1). Its five PNG identity assets are approved. Workshop vitrine, monochrome paper/ink, IBM Plex Sans. The home page leads with the catalogue and a commission banner. `DESIGN.md` is the technical translation and records leftover PICO-8 surfaces; `docs/diseno/identidad-visual.html` is a visual summary.

## Evidence on Hand

- Real product imagery for the nine seeded catalogue items, under `frontend/public/img/`.
- A verifiable engineering trail: `openspec/specs/` (capability specifications), `openspec/changes/archive/` (closed change cycles with their exploration, research, design, and verification records), and a test suite of ~1,300 tests across unit, real-database, and Playwright tiers.
- `README.md` documents setup, architecture, and testing strategy.

**Absences that must not be fabricated:** no customers, no testimonials, no sales figures, no press, no case studies, no pricing tiers, no delivery guarantees, no payment processing. Prices exist on catalogue items as seed data only.

## Product Principles

1. **The surface is evidence.** A careless interface contradicts the project's central claim, which is that its insides survive inspection. Design decisions are judged by whether they support or undermine that claim.
2. **Depth must be legible without reading code.** Whatever an evaluator cannot see, they cannot credit. Security, roles, and state handling should be visible through the interface behaving correctly under real conditions, not through claims about them.
3. **Honesty over decoration.** Never imply a transaction, a customer, or a capability that does not exist. An empty state told truthfully reads better to an evaluator than a fabricated one.
4. **Serve the shopper properly, judge by the evaluator.** Buyer-facing flows are designed as if money were at stake; when two options are otherwise equal, the one that better demonstrates judgement wins.
5. **The catalogue and the roles are fixed points.** Franchise collectibles and the ADMIN/STAFF/USER separation are product truth. Design adapts to them, not the reverse.

## Accessibility & Inclusion

No product-specific standard has been established. The existing project treats responsive behaviour and accessibility as verification criteria in its own testing strategy, so future work should not regress them; a required conformance level remains undecided.
