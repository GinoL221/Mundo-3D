## Exploration: Refactor hardcoded API URLs to use environment variables

### Current State
Multiple pages and stores in the Astro frontend hardcode 'http://localhost:3031' for API requests.

### Affected Areas
- `frontend/src/pages/index.astro` — Fetches products.
- `frontend/src/pages/login.astro` — Performs login.
- `frontend/src/pages/product.astro` — Fetches single product details.
- `frontend/src/pages/products.astro` — Fetches product list.
- `frontend/src/pages/register.astro` — Performs user registration.
- `frontend/src/store/cart.ts` — Syncs cart.
- `frontend/.env` — New environment variable file.
- `frontend/.env.example` — New environment template.
- `frontend/src/config.ts` — New configuration file.

### Approaches
1. **Direct access to meta env** — Use `import.meta.env.PUBLIC_API_URL || 'http://localhost:3031'` directly in all fetch calls.
   - Pros: No new files created.
   - Cons: Repetitive code, harder to maintain if we need to change variable name or add more config.
   - Effort: Low

2. **Centralized Configuration File** — Create `frontend/src/config.ts` exporting `API_URL`, and import it inside client-side scripts.
   - Pros: Single source of truth, cleaner imports, standard architectural practice.
   - Cons: Creates a new config file.
   - Effort: Medium

### Recommendation
We recommend **Approach 2**. It abstracts environment configuration, simplifies code maintenance, and follows clean architecture.

### Risks
- Astro client-side scripts require imports inside the `<script>` tag. We need to verify that Vite compiles the configs and imports properly.

### Ready for Proposal
Yes
