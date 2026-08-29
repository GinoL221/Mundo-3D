import { Request, Response, NextFunction } from 'express';
import { ValidationChain } from 'express-validator';
import { searchProductsValidation } from '../productValidators';

type Middleware = ValidationChain | ((req: Request, res: Response, next: NextFunction) => void);

// `searchProductsValidation` mixes express-validator chains with two terminal
// middlewares — one short-circuiting on invalid pagination, one on invalid
// filter ids (design.md's two-stage validator) — mirroring
// `orderValidators.test.ts`'s `runValidation` helper for
// `listMyOrdersValidation`. Unlike that single-stage validator, a terminal
// middleware that does NOT call `next()` here must stop the loop, exactly as
// real Express would stop advancing the chain — this is what proves
// INVALID_PAGINATION takes precedence over INVALID_FILTER: the idCategory/
// idFranchise chains never even run when pagination already failed.
const runValidation = async (query: Record<string, unknown>) => {
  const req = { query } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  for (const middleware of searchProductsValidation as Middleware[]) {
    if (typeof (middleware as ValidationChain).run === 'function') {
      await (middleware as ValidationChain).run(req);
    } else {
      let calledNext = false;
      const next = (() => {
        calledNext = true;
      }) as NextFunction;
      await (middleware as (req: Request, res: Response, next: NextFunction) => void)(req, res, next);
      if (!calledNext) {
        return { res, reachedEnd: false };
      }
    }
  }

  return { res, reachedEnd: true };
};

describe('searchProductsValidation', () => {
  it('passes through when every param is omitted', async () => {
    const { res, reachedEnd } = await runValidation({});

    expect(reachedEnd).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes through with valid page/pageSize/idCategory/idFranchise', async () => {
    const { res, reachedEnd } = await runValidation({
      page: '2',
      pageSize: '10',
      idCategory: '3',
      idFranchise: '5',
    });

    expect(reachedEnd).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([['0'], ['-1'], ['abc']])('rejects an invalid page=%s with 400 INVALID_PAGINATION', async (page) => {
    const { res, reachedEnd } = await runValidation({ page });

    expect(reachedEnd).toBe(false);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_PAGINATION' }));
  });

  it.each([['0'], ['-1'], ['51'], ['100000'], ['abc']])(
    'rejects an invalid pageSize=%s with 400 INVALID_PAGINATION',
    async (pageSize) => {
      const { res, reachedEnd } = await runValidation({ pageSize });

      expect(reachedEnd).toBe(false);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_PAGINATION' }));
    }
  );

  it('empty-string idCategory is treated as "no filter", not a 400', async () => {
    const { res, reachedEnd } = await runValidation({ idCategory: '' });

    expect(reachedEnd).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('empty-string idFranchise is treated as "no filter", not a 400', async () => {
    const { res, reachedEnd } = await runValidation({ idFranchise: '' });

    expect(reachedEnd).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a non-integer idCategory with 400 INVALID_FILTER', async () => {
    const { res, reachedEnd } = await runValidation({ idCategory: 'abc' });

    expect(reachedEnd).toBe(false);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_FILTER' }));
  });

  it('rejects a non-integer idFranchise with 400 INVALID_FILTER', async () => {
    const { res, reachedEnd } = await runValidation({ idFranchise: 'abc' });

    expect(reachedEnd).toBe(false);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_FILTER' }));
  });

  it('reports INVALID_PAGINATION, not INVALID_FILTER, when both are invalid at once', async () => {
    const { res, reachedEnd } = await runValidation({ page: 'abc', idCategory: 'abc' });

    expect(reachedEnd).toBe(false);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_PAGINATION' }));
    expect(res.status).toHaveBeenCalledTimes(1);
  });

  it('does not validate the search term itself (any string is legal)', async () => {
    const { res, reachedEnd } = await runValidation({ search: "o'brien 50% a_b" });

    expect(reachedEnd).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });
});
