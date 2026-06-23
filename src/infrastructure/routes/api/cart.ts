import { Router } from 'express';
import { SequelizeShoppingCartRepository } from '../../repositories/SequelizeShoppingCartRepository';
import { SequelizeProductRepository } from '../../repositories/SequelizeProductRepository';
import { GetCartByUserIdUseCase } from '../../../application/use-cases/GetCartByUserIdUseCase';
import { SyncCartUseCase } from '../../../application/use-cases/SyncCartUseCase';
import { CartApiController } from '../../controllers/CartApiController';
import { apiAuthMiddleware } from '../../middlewares/auth';
import { cartSyncValidation } from '../../middlewares/validators/cartValidators';

const router = Router();

const cartRepo = new SequelizeShoppingCartRepository();
const productRepo = new SequelizeProductRepository();

const getCartByUserIdUseCase = new GetCartByUserIdUseCase(cartRepo);
const syncCartUseCase = new SyncCartUseCase(cartRepo, productRepo);

const controller = new CartApiController(getCartByUserIdUseCase, syncCartUseCase);

// GET /api/cart
router.get('/cart', apiAuthMiddleware, controller.getCart);

// PUT /api/cart
router.put('/cart', apiAuthMiddleware, cartSyncValidation, controller.syncCart);

export default router;
