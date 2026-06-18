import { cartCountMiddleware } from '../cartCount';
import { Request, Response, NextFunction } from 'express';

// Mock the use case or repository dependency if needed
jest.mock('../../repositories/SequelizeShoppingCartRepository', () => {
  return {
    SequelizeShoppingCartRepository: jest.fn().mockImplementation(() => {
      return {
        getDistinctCount: jest.fn().mockImplementation(async (userId) => {
          if (userId === 42) return 3;
          if (userId === 99) return 5;
          throw new Error('Database error');
        }),
      };
    }),
  };
});

describe('cartCountMiddleware', () => {
  let req: Partial<Request>;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = {};
    res = {
      locals: {},
    };
    next = jest.fn();
  });

  it('should set cartDistinctCount to 0 when user is not logged in', async () => {
    await cartCountMiddleware(req as Request, res as Response, next);

    expect(res.locals.cartDistinctCount).toBe(0);
    expect(next).toHaveBeenCalled();
  });

  it('should retrieve distinct count and set cartDistinctCount when user is logged in', async () => {
    res.locals = {
      isLogged: true,
      userLogged: { IDUser: 42 },
    };

    await cartCountMiddleware(req as Request, res as Response, next);

    expect(res.locals.cartDistinctCount).toBe(3);
    expect(next).toHaveBeenCalled();
  });

  it('should set distinct count correctly for another user (Triangulation)', async () => {
    res.locals = {
      isLogged: true,
      userLogged: { IDUser: 99 },
    };

    await cartCountMiddleware(req as Request, res as Response, next);

    expect(res.locals.cartDistinctCount).toBe(5);
    expect(next).toHaveBeenCalled();
  });

  it('should silently default to 0 and call next when the use case throws an error', async () => {
    res.locals = {
      isLogged: true,
      userLogged: { IDUser: 666 }, // triggers the mocked error
    };

    await cartCountMiddleware(req as Request, res as Response, next);

    expect(res.locals.cartDistinctCount).toBe(0);
    expect(next).toHaveBeenCalled();
  });
});
