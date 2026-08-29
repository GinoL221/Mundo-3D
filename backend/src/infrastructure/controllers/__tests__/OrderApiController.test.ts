import { Request, Response, NextFunction } from 'express';
import { OrderApiController } from '../OrderApiController';
import { CreateOrderUseCase } from '../../../application/use-cases/CreateOrderUseCase';
import { GetOrderByIdUseCase } from '../../../application/use-cases/GetOrderByIdUseCase';
import { ListOrdersUseCase } from '../../../application/use-cases/ListOrdersUseCase';
import { ConfirmOrderPaymentUseCase } from '../../../application/use-cases/ConfirmOrderPaymentUseCase';
import { CancelOrderUseCase } from '../../../application/use-cases/CancelOrderUseCase';
import { ListMyOrdersUseCase } from '../../../application/use-cases/ListMyOrdersUseCase';
import { EmptyCartException } from '../../../domain/exceptions/EmptyCartException';
import { InsufficientStockException } from '../../../domain/exceptions/InsufficientStockException';
import { IllegalOrderTransitionException } from '../../../domain/exceptions/IllegalOrderTransitionException';
import { Role } from '../../../domain/Role';

describe('OrderApiController', () => {
  let controller: OrderApiController;
  let mockCreateOrderUseCase: jest.Mocked<CreateOrderUseCase>;
  let mockGetOrderByIdUseCase: jest.Mocked<GetOrderByIdUseCase>;
  let mockListOrdersUseCase: jest.Mocked<ListOrdersUseCase>;
  let mockConfirmOrderPaymentUseCase: jest.Mocked<ConfirmOrderPaymentUseCase>;
  let mockCancelOrderUseCase: jest.Mocked<CancelOrderUseCase>;
  let mockListMyOrdersUseCase: jest.Mocked<ListMyOrdersUseCase>;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const sampleOrder = {
    idOrder: 41,
    idUser: 7,
    status: 'AWAITING_PAYMENT',
    items: [],
    totalAmount: 3000,
    createdAt: '2026-08-28T14:03:11.000Z',
    paymentReference: null,
  };

  beforeEach(() => {
    mockCreateOrderUseCase = { execute: jest.fn() } as any;
    mockGetOrderByIdUseCase = { execute: jest.fn() } as any;
    mockListOrdersUseCase = { execute: jest.fn() } as any;
    mockConfirmOrderPaymentUseCase = { execute: jest.fn() } as any;
    mockCancelOrderUseCase = { execute: jest.fn() } as any;
    mockListMyOrdersUseCase = { execute: jest.fn() } as any;

    controller = new OrderApiController(
      mockCreateOrderUseCase,
      mockGetOrderByIdUseCase,
      mockListOrdersUseCase,
      mockConfirmOrderPaymentUseCase,
      mockCancelOrderUseCase,
      mockListMyOrdersUseCase
    );

    req = { params: {}, body: {}, headers: {}, user: { userId: 7, idRole: Role.USER } };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
      send: jest.fn().mockReturnThis() as any,
    };
    next = jest.fn();
  });

  describe('create', () => {
    it('returns 201 and the created order on success', async () => {
      req.headers = { 'idempotency-key': 'key-1' };
      mockCreateOrderUseCase.execute.mockResolvedValue(sampleOrder as any);

      await controller.create(req as Request, res as Response, next);

      expect(mockCreateOrderUseCase.execute).toHaveBeenCalledWith(7, 'key-1');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(sampleOrder);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 409 EMPTY_CART when the use case throws EmptyCartException', async () => {
      req.headers = { 'idempotency-key': 'key-1' };
      mockCreateOrderUseCase.execute.mockRejectedValue(new EmptyCartException());

      await controller.create(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'EMPTY_CART' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 409 INSUFFICIENT_STOCK with the full shortages list', async () => {
      req.headers = { 'idempotency-key': 'key-1' };
      const shortages = [
        { idProduct: 12, productName: 'Maceta Groot', requested: 3, available: 1 },
        { idProduct: 19, productName: 'Casco Mando', requested: 1, available: 0 },
      ];
      mockCreateOrderUseCase.execute.mockRejectedValue(new InsufficientStockException(shortages));

      await controller.create(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INSUFFICIENT_STOCK', shortages })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.headers = { 'idempotency-key': 'key-1' };
      const error = new Error('DB is down');
      mockCreateOrderUseCase.execute.mockRejectedValue(error);

      await controller.create(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('returns 200 and the order when the buyer owns it', async () => {
      req.params = { id: '41' };
      mockGetOrderByIdUseCase.execute.mockResolvedValue(sampleOrder as any);

      await controller.show(req as Request, res as Response, next);

      expect(mockGetOrderByIdUseCase.execute).toHaveBeenCalledWith(41, 7, false);
      expect(res.json).toHaveBeenCalledWith(sampleOrder);
      expect(next).not.toHaveBeenCalled();
    });

    it('passes isAdmin=true through to the use case for an ADMIN principal', async () => {
      req.params = { id: '41' };
      req.user = { userId: 999, idRole: Role.ADMIN };
      mockGetOrderByIdUseCase.execute.mockResolvedValue(sampleOrder as any);

      await controller.show(req as Request, res as Response, next);

      expect(mockGetOrderByIdUseCase.execute).toHaveBeenCalledWith(41, 999, true);
    });

    it('returns 404 ORDER_NOT_FOUND when the use case resolves null', async () => {
      req.params = { id: '999' };
      mockGetOrderByIdUseCase.execute.mockResolvedValue(null);

      await controller.show(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ORDER_NOT_FOUND' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 when :id is not numeric', async () => {
      req.params = { id: 'not-a-number' };

      await controller.show(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockGetOrderByIdUseCase.execute).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.params = { id: '41' };
      const error = new Error('DB is down');
      mockGetOrderByIdUseCase.execute.mockRejectedValue(error);

      await controller.show(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('index', () => {
    it('returns 200 and the order list', async () => {
      mockListOrdersUseCase.execute.mockResolvedValue([sampleOrder] as any);

      await controller.index(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith([sampleOrder]);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      const error = new Error('DB is down');
      mockListOrdersUseCase.execute.mockRejectedValue(error);

      await controller.index(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('confirmPayment', () => {
    it('returns 200 and the confirmed order on success', async () => {
      req.params = { id: '41' };
      mockConfirmOrderPaymentUseCase.execute.mockResolvedValue({ ...sampleOrder, status: 'PAID' } as any);

      await controller.confirmPayment(req as Request, res as Response, next);

      expect(mockConfirmOrderPaymentUseCase.execute).toHaveBeenCalledWith(41);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 409 ILLEGAL_ORDER_TRANSITION when the use case throws', async () => {
      req.params = { id: '41' };
      mockConfirmOrderPaymentUseCase.execute.mockRejectedValue(new IllegalOrderTransitionException());

      await controller.confirmPayment(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ILLEGAL_ORDER_TRANSITION' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 when :id is not numeric', async () => {
      req.params = { id: 'not-a-number' };

      await controller.confirmPayment(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockConfirmOrderPaymentUseCase.execute).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.params = { id: '41' };
      const error = new Error('DB is down');
      mockConfirmOrderPaymentUseCase.execute.mockRejectedValue(error);

      await controller.confirmPayment(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('cancel', () => {
    it('returns 200 and the cancelled order on success', async () => {
      req.params = { id: '41' };
      mockCancelOrderUseCase.execute.mockResolvedValue({ ...sampleOrder, status: 'CANCELLED' } as any);

      await controller.cancel(req as Request, res as Response, next);

      expect(mockCancelOrderUseCase.execute).toHaveBeenCalledWith(41);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'CANCELLED' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 409 ILLEGAL_ORDER_TRANSITION when the use case throws', async () => {
      req.params = { id: '41' };
      mockCancelOrderUseCase.execute.mockRejectedValue(new IllegalOrderTransitionException());

      await controller.cancel(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ILLEGAL_ORDER_TRANSITION' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 when :id is not numeric', async () => {
      req.params = { id: 'not-a-number' };

      await controller.cancel(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCancelOrderUseCase.execute).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to next', async () => {
      req.params = { id: '41' };
      const error = new Error('DB is down');
      mockCancelOrderUseCase.execute.mockRejectedValue(error);

      await controller.cancel(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('listMine', () => {
    const samplePage = {
      orders: [
        {
          idOrder: 41,
          idUser: 7,
          status: 'AWAITING_PAYMENT',
          totalAmount: 3000,
          createdAt: '2026-08-28T14:03:11.000Z',
          paymentReference: null,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    };

    it('reads req.user.userId and defaults page=1/pageSize=20 when omitted', async () => {
      req.query = {};
      mockListMyOrdersUseCase.execute.mockResolvedValue(samplePage as any);

      await controller.listMine(req as Request, res as Response, next);

      expect(mockListMyOrdersUseCase.execute).toHaveBeenCalledWith(7, 1, 20);
      expect(res.json).toHaveBeenCalledWith(samplePage);
      expect(next).not.toHaveBeenCalled();
    });

    it('parses provided page/pageSize query params', async () => {
      req.query = { page: '2', pageSize: '10' };
      mockListMyOrdersUseCase.execute.mockResolvedValue(samplePage as any);

      await controller.listMine(req as Request, res as Response, next);

      expect(mockListMyOrdersUseCase.execute).toHaveBeenCalledWith(7, 2, 10);
    });

    it('forwards unexpected errors to next without calling handleDomainError mappings', async () => {
      req.query = {};
      const error = new Error('DB is down');
      mockListMyOrdersUseCase.execute.mockRejectedValue(error);

      await controller.listMine(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
