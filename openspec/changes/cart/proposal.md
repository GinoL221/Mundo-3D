# Proposal: Cart Module Migration

## Intent
Migrate legacy JavaScript cart components to TypeScript and Hexagonal Architecture on the `feature/pixel-art-foundation` branch. This resolves technical debt and decouples the Cart domain from Product.

## Scope
### In Scope
- Define TS domain entity `ShoppingCart.ts` with `CartStatus` enum (`ACTIVE`, `ORDERED`, `ABANDONED`) and stock limits validation.
- Implement repository port `IShoppingCartRepository.ts` and Sequelize repository adapter.
- Implement use cases `GetCartByUserIdUseCase` (including price drift comparison logic) and `GetCartDistinctCountUseCase`.
- Implement `CartController`, `cartRoutes.ts` router, and ported TS middleware `cartCount.ts`.
- Map use case output to legacy EJS DTO format to preserve EJS rendering.
- Delete legacy `cartService.js` and `viewShoppingCart.js`.

### Out of Scope
- Direct UI modifications to display the price drift warning notification.
- Adding a physical `Stock` column to database.

## Capabilities
### New Capabilities
- `cart-domain`: Domain entity enforcing cart status, stock boundaries, and price drift logic.

### Modified Capabilities
- `cart-service`: Replace legacy JS service and MVC controller with Hexagonal TypeScript components.
- `cart-computation`: Calculate cart total inside use case/controller layer.

## Approach
Implement **Approach A** (Modular Routing). Create dedicated `cartRoutes.ts` router, register in `app.js`, and inject dependencies. Maintain EJS view rendering by mapping use case outputs to the legacy EJS DTO contract.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/domain/entities/ShoppingCart.ts` | New | Domain model and status enum |
| `src/domain/ports/IShoppingCartRepository.ts` | New | Repository port interface |
| `src/application/use-cases/` | New | GetCartByUserId, GetCartDistinctCount use cases |
| `src/infrastructure/repositories/` | New | Sequelize repository implementation |
| `src/infrastructure/controllers/CartController.ts` | New | Replaces legacy viewShoppingCart |
| `src/infrastructure/routes/cartRoutes.ts` | New | Decoupled router mounted in `app.js` |
| `src/infrastructure/middlewares/cartCount.ts` | New | Ported TS middleware |
| `src/services/cartService.js` | Removed | Legacy service |
| `src/controllers/products/viewShoppingCart.js` | Removed | Legacy controller |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| EJS template data structure breakage | High | DTO maps exact property paths of legacy models |
| DB missing Stock column for validation | Med | Handle stock as mock or read-only domain attribute |

## Rollback Plan
Discard changes on `feature/pixel-art-foundation` branch using `git checkout` or `git revert` to restore the legacy JS files.

## Dependencies
- [ ] Cart unit and integration tests compile and pass.
- [ ] Integration tests verify EJS template renders without error and cart badge behaves identically.
