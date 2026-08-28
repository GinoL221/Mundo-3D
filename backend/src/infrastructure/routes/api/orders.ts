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

/**
 * @openapi
 * /orders:
 *   post:
 *     summary: Check out the caller's cart into an order
 *     tags: [Orders]
 *     security: [{ cookieAuth: [], csrfHeader: [] }]
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string }
 *         description: Client-generated dedup token (order-checkout spec). Missing/blank -> 400 IDEMPOTENCY_KEY_REQUIRED.
 *     responses:
 *       '201':
 *         description: Order created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Order' }
 *       '400':
 *         description: Missing Idempotency-Key header.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorWithCode' }
 *       '401': { description: Not authenticated. }
 *       '409':
 *         description: Empty cart, or insufficient stock for one or more items.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ErrorWithCode'
 *                 - $ref: '#/components/schemas/InsufficientStockError'
 *   get:
 *     summary: List all orders (admin only)
 *     tags: [Orders]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       '200':
 *         description: All orders.
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/Order' } }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN. }
 * /orders/{id}:
 *   get:
 *     summary: Get one order by id
 *     description: >
 *       No adminGuard: the controller compares the requester against the
 *       order's owner and returns 404 for a non-owner (avoids order-id
 *       enumeration), with an ADMIN bypass — design.md "Routes and the ADMIN
 *       guard".
 *     tags: [Orders]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The order.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Order' }
 *       '400': { description: Non-numeric id. }
 *       '401': { description: Not authenticated. }
 *       '404':
 *         description: Not found, or not owned by the caller (non-ADMIN).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorWithCode' }
 * /orders/{id}/confirm-payment:
 *   post:
 *     summary: Confirm payment for an order (admin only)
 *     tags: [Orders]
 *     security: [{ cookieAuth: [], csrfHeader: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Order with updated payment/status.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Order' }
 *       '400': { description: Non-numeric id. }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN. }
 *       '409':
 *         description: Illegal order state transition.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorWithCode' }
 * /orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order and restock its items (admin only)
 *     tags: [Orders]
 *     security: [{ cookieAuth: [], csrfHeader: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Cancelled order.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Order' }
 *       '400': { description: Non-numeric id. }
 *       '401': { description: Not authenticated. }
 *       '403': { description: Authenticated but not ADMIN. }
 *       '409':
 *         description: Illegal order state transition.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorWithCode' }
 */
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
