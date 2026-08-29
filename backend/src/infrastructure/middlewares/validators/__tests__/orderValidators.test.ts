import { Request, Response, NextFunction } from 'express';
import { ValidationChain } from 'express-validator';
import { listMyOrdersValidation } from '../orderValidators';

type Middleware = ValidationChain | ((req: Request, res: Response, next: NextFunction) => void);

// `listMyOrdersValidation` mixes express-validator chains with a terminal
// middleware (design decision #4, mirroring `orderCreateValidation`), so it
// cannot be exercised with `validationResult` alone — each chain must `run`
// against the request before the terminal middleware inspects the result.
const runValidation = async (query: Record<string, unknown>) => {
  const req = { query } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;

  for (const middleware of listMyOrdersValidation as Middleware[]) {
    if (typeof (middleware as ValidationChain).run === 'function') {
      await (middleware as ValidationChain).run(req);
    } else {
      await (middleware as (req: Request, res: Response, next: NextFunction) => void)(req, res, next);
    }
  }

  return { res, next };
};

describe('listMyOrdersValidation', () => {
  it('calls next without a 400 when page/pageSize are omitted', async () => {
    const { res, next } = await runValidation({});

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next when page/pageSize are valid', async () => {
    const { res, next } = await runValidation({ page: '2', pageSize: '10' });

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([['0'], ['-1'], ['abc']])('rejects an invalid page=%s with 400 INVALID_PAGINATION', async (page) => {
    const { res, next } = await runValidation({ page });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_PAGINATION' }));
    expect(next).not.toHaveBeenCalled();
  });

  it.each([['0'], ['-1'], ['51'], ['abc']])(
    'rejects an invalid pageSize=%s with 400 INVALID_PAGINATION',
    async (pageSize) => {
      const { res, next } = await runValidation({ pageSize });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_PAGINATION' }));
      expect(next).not.toHaveBeenCalled();
    }
  );
});
