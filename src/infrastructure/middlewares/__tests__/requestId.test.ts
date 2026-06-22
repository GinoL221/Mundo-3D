import { Request, Response, NextFunction } from 'express';
import requestIdMiddleware from '../requestId';

describe('requestId middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      setHeader: jest.fn()
    } as unknown as Partial<Response>;
    next = jest.fn();
  });

  it('should generate a uuid and assign to req.reqId and set response header if not present', () => {
    requestIdMiddleware(req as Request, res as Response, next);

    expect(req.reqId).toBeDefined();
    expect(typeof req.reqId).toBe('string');
    expect(req.reqId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.reqId);
    expect(next).toHaveBeenCalled();
  });

  it('should reuse the existing x-request-id header if present', () => {
    const existingId = 'existing-correlation-id-12345';
    req.headers = {
      'x-request-id': existingId
    };

    requestIdMiddleware(req as Request, res as Response, next);

    expect(req.reqId).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', existingId);
    expect(next).toHaveBeenCalled();
  });
});
