import { Router } from 'express';
// @ts-ignore
import { isUser } from '../../middlewares/auth';
import { SequelizeShoppingCartRepository } from '../repositories/SequelizeShoppingCartRepository';
import { GetCartByUserIdUseCase } from '../../application/use-cases/GetCartByUserIdUseCase';
import { CartController } from '../controllers/CartController';

const router = Router();

// Setup dependency injection
const cartRepo = new SequelizeShoppingCartRepository();
const getCartByUserIdUseCase = new GetCartByUserIdUseCase(cartRepo);
const controller = new CartController(getCartByUserIdUseCase);

// Mount view cart route
router.get('/productCart', isUser, (req, res, next) => {
  controller.viewCart(req, res, next);
});

export default router;
