import { Router } from 'express';
import { SequelizeShoppingCartRepository } from '../../repositories/SequelizeShoppingCartRepository';
import { SequelizeProductRepository } from '../../repositories/SequelizeProductRepository';
import { GetCartByUserIdUseCase } from '../../../application/use-cases/GetCartByUserIdUseCase';
import { SyncCartUseCase } from '../../../application/use-cases/SyncCartUseCase';
import { CartApiController } from '../../controllers/CartApiController';
import { apiAuthMiddleware, buyerGuard } from '../../middlewares/auth';
import { csrfGuard } from '../../middlewares/csrf';
import { cartSyncValidation } from '../../middlewares/validators/cartValidators';

const router = Router();

const cartRepo = new SequelizeShoppingCartRepository();
const productRepo = new SequelizeProductRepository();

const getCartByUserIdUseCase = new GetCartByUserIdUseCase(cartRepo);
const syncCartUseCase = new SyncCartUseCase(cartRepo, productRepo);

const controller = new CartApiController(getCartByUserIdUseCase, syncCartUseCase);

/**
 * @openapi
 * /cart:
 *   get:
 *     summary: Get the caller's cart
 *     tags: [Cart]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       '200':
 *         description: The caller's cart.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CartResult' }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated as STAFF or ADMIN (operational accounts do not hold a cart). }
 *   put:
 *     summary: Full-replace sync the caller's cart
 *     tags: [Cart]
 *     security: [{ cookieAuth: [], csrfHeader: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 description: May be empty (represents an emptied cart).
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId: { type: integer, minimum: 1 }
 *                     quantity: { type: integer, minimum: 1, description: 'Max MAX_CART_ITEM_QUANTITY.' }
 *                   required: [productId, quantity]
 *             required: [items]
 *     responses:
 *       '200':
 *         description: Cart synced.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CartSyncResponse' }
 *       '400': { description: Invalid cart items (CartValidationException). }
 *       '401': { description: Not authenticated. }
 *       '403': { description: 'Authenticated as STAFF or ADMIN, or invalid/missing CSRF token.' }
 */
// GET /api/cart
router.get('/cart', apiAuthMiddleware, buyerGuard, controller.getCart);

// PUT /api/cart
router.put('/cart', apiAuthMiddleware, buyerGuard, csrfGuard, cartSyncValidation, controller.syncCart);

export default router;
