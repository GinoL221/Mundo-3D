import { Request, Response, NextFunction } from 'express';
import { query, validationResult } from 'express-validator';
import { MAX_PAGE_SIZE } from '../../../application/use-cases/ListMyOrdersUseCase';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

// `POST /api/orders` requires a client-generated `Idempotency-Key` header
// (order-checkout spec, "Idempotency Key on Checkout"). Unlike the other
// validators in this folder (express-validator chains consumed by the shared
// `handleValidationErrors`), this check must emit the exact `{ error, code }`
// shape from design.md's controller error-map table
// (`IDEMPOTENCY_KEY_REQUIRED`) so the client can branch on `code`
// programmatically — a plain express-validator body-shape (`{ errors: [...] }`)
// would not carry that `code` field. It is deliberately a standalone
// middleware, not an express-validator chain, and short-circuits the request
// itself rather than deferring to `handleValidationErrors`.
export const orderCreateValidation = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const key = req.headers[IDEMPOTENCY_KEY_HEADER];

  if (typeof key !== 'string' || key.trim() === '') {
    return res.status(400).json({
      error: 'Falta el header Idempotency-Key',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
  }

  next();
};

// `GET /orders/mine` pagination bounds (order-history spec, "Pagination
// Parameter Validation"). Like `orderCreateValidation` above, this emits the
// `{ error, code }` shape the client branches on rather than deferring to
// the shared `handleValidationErrors` (design decision #4): there is no
// domain exception behind an out-of-range page/pageSize, and the generic
// validator's `{ errors: [...] }` body can't carry a `code` field. Omitted
// values are valid — `ListMyOrdersUseCase`/the controller apply the
// page=1/pageSize=20 defaults.
export const listMyOrdersValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }),
  (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({
        error: 'Parámetros de paginación inválidos',
        code: 'INVALID_PAGINATION',
      });
    }
    next();
  },
];
