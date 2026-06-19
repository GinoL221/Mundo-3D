import { Request, Response, NextFunction } from 'express';
import errorHandler from '../errorHandler';

describe('errorHandler middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let consoleErrorSpy: jest.SpyInstance;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any
    };
    next = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  it('handles standard error in development and returns message and stack', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Database connection failed');
    (err as any).status = 503;

    errorHandler(err, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Database connection failed',
        stack: err.stack
      })
    );
  });

  it('handles standard error in production and hides message/stack details', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Database connection failed');
    (err as any).status = 503;

    errorHandler(err, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Algo salió mal. Intente nuevamente más tarde.'
    });
  });

  it('defaults to status code 500 if not specified', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Some unknown failure');

    errorHandler(err, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
