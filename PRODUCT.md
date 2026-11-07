# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: technical evaluators.** Recruiters, hiring managers, and engineers who open this project to judge how its author builds. They arrive from a CV, a repository link, or a conversation, and they are deciding something about the author, not buying a figurine. They skim, they poke at edges, and they leave quickly if nothing earns more attention. What they are actually doing is looking for evidence of judgement.

**Secondary: the shopper the storefront serves.** Someone browsing 3D-printed collectibles, or commissioning a custom piece. This persona is not currently transacting with real money, but the storefront must behave as if they were — an evaluator reads a hollow flow as a hollow project. Every buyer-facing decision is made honestly, then judged by the primary user.

The two audiences are not in conflict, but the primary one decides ties.

## Product Purpose

Mundo-3D is a portfolio project in the form of a working e-commerce for 3D-printed products: pre-made collectibles from known franchises, and custom commissions. Its target deliverable is a public, interactive web demo that a recruiter can explore through a link without installing tools or configuring an environment.

It exists to demonstrate engineering and design judgement through something complete rather than described. Success is an evaluator concluding that the author builds carefully — not a sales figure or the number of features. The interface is part of the deliverable: a well-argued architecture behind a careless surface reads as an unfinished project.

Public availability and safe demo access are product goals, not claims that deployment or visitor isolation already exists.

## Positioning

What a neighbouring project could not truthfully copy is the depth behind the storefront. This is not a template with seeded rows: session handling, refresh-token rotation with reuse detection, CSRF, role separation, real-database integration tests, and a documented specification trail are all present and verifiable in the repository.

The product's claim is therefore not "an online store" but **a storefront whose insides survive inspection**. The design's job is to make that claim legible to someone who has not read the code, and never to contradict it.

## Operating Context

Evaluation happens on a laptop, in minutes, often with several tabs of other candidates open. It starts from a public demo link or the repository README and must not require a local setup. Mobile viewing is plausible but secondary to that first desktop pass.

The shopping context the storefront depicts is ordinary consumer browsing: catalogue, product detail, cart, simulated checkout, and order history. An optional short guide should explain what to try and what each flow demonstrates, without forcing visitors through a tutorial or turning the storefront into a technical presentation.

## Target Demo Experience

This section defines the intended experience, not the current implementation status.

- **Immediate entry:** browse the catalogue, product details, and cart without registration.
- **Interactive buyer access:** use a safe demo session to create a clearly simulated order and inspect its history, without registration friction or real payment.
- **Interactive STAFF access:** inspect custom-commission requests and exercise permitted staff actions. ADMIN access is not publicly available.
- **Safe exploration:** use fictitious data, backend-enforced permissions and usage limits, isolation between visitors, and a recoverable demo state. Shared credentials that let visitors interfere with one another are not an acceptable shortcut.
- **Visible engineering evidence:** provide discoverable links to the repository, architecture, and verification records while keeping shopping flows focused on the shopper.

### Demo Acceptance Criteria

The target demo is ready when an evaluator can:

1. Open a public URL and browse without installing tools, configuring services, or registering.
2. Complete a simulated buyer flow from catalogue to cart, order creation, and order history, with no real charge.
3. Try the STAFF role and observe its permission boundaries without obtaining ADMIN access or affecting another visitor's session or data.
4. Submit a fictitious custom-commission request and inspect it through the intended STAFF demo flow, without sending real email or implying a quote or order was created.
5. Explore a usable, recoverable dataset with clear loading, empty, validation, and failure states, without exposing real personal data or secrets.
6. Find the repository and supporting engineering evidence without following a mandatory guided tour.

Buyer interaction is the first delivery priority; public STAFF interaction follows only when its isolation and backend restrictions are verified. These criteria do not authorize deployment or database changes.

## Capabilities and Constraints

**Implemented capabilities** (repository functionality, not a claim that a public deployment or its operational configuration has been verified):

- Catalogue with categories and franchises; product detail pages.
- Registration and login with JWT in an `httpOnly` cookie, signed double-submit CSRF, refresh-token rotation with family-wide reuse detection, and per-IP plus per-account login throttling.
- Three-role model: `ADMIN` (1), `USER` (2), `STAFF` (3). STAFF can create and update products but not delete them.
- Product administration with stock and images; category, franchise, and user administration.
- Local cart with Nanostores, synchronised to the API for authenticated users.
- Orders and order history.
- Informational pages: about, FAQ, help, step-by-step, terms, privacy.
- Public custom commission request intake without an account, collecting name, email, and idea, with optional catalog-product association. Requests are available for STAFF/ADMIN review and expire after 30 days; physical purge runs hourly while the backend is active or at its next startup. No automated contact or transaction is implied.
- Light/dark theme.

The target demo's public access, safe buyer/STAFF sessions, visitor isolation, usage limits, and state recovery must be assessed separately. Existing authentication and roles alone do not establish that these demo requirements are satisfied.

**Technical constraints:**

- Astro frontend, Express/TypeScript backend in hexagonal layers, Sequelize over MySQL/MariaDB, pnpm workspace monorepo.
- Architecture rule `frontend.domain.locality`: a file under `frontend/src/domains/**` may import only from its own domain or from `frontend/src/config.ts`.
- CSS has no build step; tokens live in `frontend/src/styles/tokens/` and are consumed by component stylesheets.
- Helmet CSP is explicit and stricter than defaults; no inline scripts in backend-served HTML.

**Scope boundaries and exclusions:**

- **Custom commissions are part of the product.** The supported slice is request submission and staff review, not quoting, commission-order tracking, or payment. The catalogue contains pre-made franchise pieces and leads the home page; commissions follow as a secondary banner or featured section.
- Orders demonstrate a simulated purchase flow. Payment processing is not implemented, and no real transaction occurs. Demo copy must make this explicit.
- The public demo must not send real email, collect real customer data, or expose ADMIN access. This is a target constraint, not a claim that current application behavior already enforces it.
- Real commercial operations, payment processing, automated commission email, and new quoting or tracking workflows are outside the agreed demo scope. They require separate product decisions.
- Hosting, demo-session mechanics, isolation, reset strategy, and operational configuration need a separate implementation and deployment plan; this document does not prescribe their technical design.

## Brand Commitments

- **Name:** Mundo 3D.
- **Voice:** Rioplatense Spanish, informal second person (_vos_). Present throughout the existing copy ("Recibí tu pedido", "Estamos para vos"). Binding.
- **The franchise catalogue is the business,** not placeholder data. Mario, Captain America, Batman, Iron Man, Joker, Spider-Man, Sonic. Confirmed as non-negotiable.
- **The home page leads with the catalogue.** Custom commissions follow as a secondary banner or featured section. Binding.
- **The three-role model is non-negotiable**, including STAFF's deliberate inability to delete products. It reflects how the product is meant to be operated.

**Visual identity:** brand authority is `docs/diseno/manual-identidad.md` (v0.1). Its five PNG identity assets are approved. Workshop vitrine, monochrome paper/ink, IBM Plex Sans. The home page leads with the catalogue and a commission banner. `DESIGN.md` is the technical translation and records leftover PICO-8 surfaces; `docs/diseno/identidad-visual.html` is a visual summary.

## Evidence on Hand

- Real product imagery for the nine seeded catalogue items, under `frontend/public/img/`.
- A verifiable engineering trail: `openspec/specs/` (capability specifications), `openspec/changes/archive/` (closed change cycles with their exploration, research, design, and verification records), and tests across unit, real-database, and Playwright tiers. Current execution results belong in verification records, not in a fixed test-count claim here.
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
