import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { csrfProtection } from '../csrf';

describe('csrfProtection middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      path: '/some-page',
      method: 'GET',
      session: {},
      headers: {},
      body: {},
      query: {}
    };
    res = {
      locals: {},
      status: jest.fn().mockReturnThis() as any,
      render: jest.fn().mockReturnThis() as any
    };
    next = jest.fn();
  });

  it('skips CSRF check for API routes starting with /api/', () => {
    (req as any).path = '/api/users';
    req.method = 'POST';
    csrfProtection(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('generates a token and stores it in session and locals on GET requests', () => {
    req.method = 'GET';
    csrfProtection(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.session!.csrfToken).toBeDefined();
    expect(res.locals!.csrfToken).toBe(req.session!.csrfToken);
  });

  it('returns 403 Forbidden when POST request is missing token', () => {
    req.method = 'POST';
    req.session!.csrfToken = 'abcdef';
    csrfProtection(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.render).toHaveBeenCalledWith(expect.stringContaining('403Forbidden.ejs'), expect.any(Object));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 Forbidden when POST request has mismatched token', () => {
    req.method = 'POST';
    req.session!.csrfToken = crypto.randomBytes(32).toString('hex');
    req.body._csrf = crypto.randomBytes(32).toString('hex');
    csrfProtection(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.render).toHaveBeenCalledWith(expect.stringContaining('403Forbidden.ejs'), expect.any(Object));
    expect(next).not.toHaveBeenCalled();
  });

  it('allows POST request and generates a new token when token matches', () => {
    req.method = 'POST';
    const token = crypto.randomBytes(32).toString('hex');
    req.session!.csrfToken = token;
    req.body._csrf = token;
    csrfProtection(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.session!.csrfToken).not.toBe(token); // A new token is generated
    expect(res.locals!.csrfToken).toBe(req.session!.csrfToken);
  });
});
