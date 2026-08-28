import { Router } from 'express';
import { SequelizeOrderRepository } from '../../repositories/SequelizeOrderRepository';
import { SequelizeShoppingCartRepository } from '../../repositories/SequelizeShoppingCartRepository';
import { SequelizeProductRepository } from '../../repositories/SequelizeProductRepository';
import { SequelizeUnitOfWork } from '../../persistence/SequelizeUnitOfWork';
import { ManualPaymentGateway } from '../../payments/ManualPaymentGateway';
import { PinoLogger } from '../../logging/PinoLogger';
import { CreateOrderUseCase } from '../../../application/use-cases/CreateOrderUseCase';
import { GetOrderByIdUseCase } from '../../../application/use-cases/GetOrderByIdUseCase';
import { ListOrdersUseCase } from '../../../application/use-cases/ListOrdersUseCase';
import { ConfirmOrderPaymentUseCase } from '../../../application/use-cases/ConfirmOrderPaymentUseCase';
import { CancelOrderUseCase } from '../../../application/use-cases/CancelOrderUseCase';
import { OrderApiController } from '../../controllers/OrderApiController';
import { apiAuthMiddleware, adminGuard } from '../../middlewares/auth';
import { csrfGuard } from '../../middlewares/csrf';
import { orderCreateValidation } from '../../middlewares/validators/orderValidators';

const router = Router();

const orderRepo = new SequelizeOrderRepository();
const cartRepo = new SequelizeShoppingCartRepository();
const productRepo = new SequelizeProductRepository();
const uow = new SequelizeUnitOfWork();
const paymentGateway = new ManualPaymentGateway();
const logger = new PinoLogger();

const createOrderUseCase = new CreateOrderUseCase(uow, orderRepo, cartRepo, productRepo, paymentGateway, logger);
const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepo);
const listOrdersUseCase = new ListOrdersUseCase(orderRepo);
const confirmOrderPaymentUseCase = new ConfirmOrderPaymentUseCase(orderRepo);
const cancelOrderUseCase = new CancelOrderUseCase(uow, orderRepo, productRepo);

const controller = new OrderApiController(
  createOrderUseCase,
  getOrderByIdUseCase,
  listOrdersUseCase,
  confirmOrderPaymentUseCase,
  cancelOrderUseCase
);

// `GET /orders/:id` deliberately carries no `adminGuard`: `OrderApiController.show`
// compares the requester against the order's owner and returns 404 for a
// non-owner (avoids order-id enumeration), with an ADMIN bypass — design.md
// "Routes and the ADMIN guard".
router.post('/orders', apiAuthMiddleware, csrfGuard, orderCreateValidation, controller.create);
router.get('/orders/:id', apiAuthMiddleware, controller.show);
router.get('/orders', apiAuthMiddleware, adminGuard, controller.index);
router.post('/orders/:id/confirm-payment', apiAuthMiddleware, csrfGuard, adminGuard, controller.confirmPayment);
router.post('/orders/:id/cancel', apiAuthMiddleware, csrfGuard, adminGuard, controller.cancel);

export default router;
