import { Request, Response, NextFunction } from 'express';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase';
import { GetOrderByIdUseCase } from '../../application/use-cases/GetOrderByIdUseCase';
import { ListOrdersUseCase } from '../../application/use-cases/ListOrdersUseCase';
import { ConfirmOrderPaymentUseCase } from '../../application/use-cases/ConfirmOrderPaymentUseCase';
import { CancelOrderUseCase } from '../../application/use-cases/CancelOrderUseCase';
import { ListMyOrdersUseCase, DEFAULT_PAGE_SIZE } from '../../application/use-cases/ListMyOrdersUseCase';
import { EmptyCartException } from '../../domain/exceptions/EmptyCartException';
import { InsufficientStockException } from '../../domain/exceptions/InsufficientStockException';
import { IllegalOrderTransitionException } from '../../domain/exceptions/IllegalOrderTransitionException';
import { Role } from '../../domain/Role';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

// `Role` is imported here (infrastructure), never in domain/application —
// design.md "Routes and the ADMIN guard".
export class OrderApiController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly listOrdersUseCase: ListOrdersUseCase,
    private readonly confirmOrderPaymentUseCase: ConfirmOrderPaymentUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly listMyOrdersUseCase: ListMyOrdersUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idempotencyKey = req.headers[IDEMPOTENCY_KEY_HEADER] as string;
      const order = await this.createOrderUseCase.execute(req.user!.userId, idempotencyKey);
      res.status(201).json(order);
    } catch (error) {
      if (this.handleDomainError(error, res)) {
        return;
      }
      next(error);
    }
  };

  show = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Id de orden inválido' });
        return;
      }

      const isAdmin = req.user?.idRole === Role.ADMIN;
      const order = await this.getOrderByIdUseCase.execute(id, req.user!.userId, isAdmin);
      if (!order) {
        res.status(404).json({ error: 'Orden no encontrada', code: 'ORDER_NOT_FOUND' });
        return;
      }
      res.json(order);
    } catch (error) {
      if (this.handleDomainError(error, res)) {
        return;
      }
      next(error);
    }
  };

  index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orders = await this.listOrdersUseCase.execute();
      res.json(orders);
    } catch (error) {
      next(error);
    }
  };

  confirmPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Id de orden inválido' });
        return;
      }

      const order = await this.confirmOrderPaymentUseCase.execute(id);
      res.json(order);
    } catch (error) {
      if (this.handleDomainError(error, res)) {
        return;
      }
      next(error);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Id de orden inválido' });
        return;
      }

      const order = await this.cancelOrderUseCase.execute(id);
      res.json(order);
    } catch (error) {
      if (this.handleDomainError(error, res)) {
        return;
      }
      next(error);
    }
  };

  // Buyer-scoped, paginated order history (order-history spec). A read
  // raises no domain exception, so unexpected errors go straight to `next`
  // — no `handleDomainError` call, unlike the mutating handlers above.
  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize
        ? parseInt(req.query.pageSize as string, 10)
        : DEFAULT_PAGE_SIZE;
      const result = await this.listMyOrdersUseCase.execute(req.user!.userId, page, pageSize);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // Full controller error map (design.md): every domain exception carries an
  // English `code` for programmatic use alongside the Spanish message, like
  // every existing controller. Returns true when the error was handled.
  private handleDomainError(error: unknown, res: Response): boolean {
    if (error instanceof EmptyCartException) {
      res.status(409).json({ error: 'El carrito está vacío', code: 'EMPTY_CART' });
      return true;
    }
    if (error instanceof InsufficientStockException) {
      res.status(409).json({
        error: 'Stock insuficiente para uno o más productos',
        code: 'INSUFFICIENT_STOCK',
        shortages: error.shortages,
      });
      return true;
    }
    if (error instanceof IllegalOrderTransitionException) {
      res.status(409).json({
        error: 'Transición de estado de orden no permitida',
        code: 'ILLEGAL_ORDER_TRANSITION',
      });
      return true;
    }
    return false;
  }
}
