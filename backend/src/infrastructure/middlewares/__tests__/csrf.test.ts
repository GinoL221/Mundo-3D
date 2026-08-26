import { Request, Response, NextFunction } from 'express';
import { csrfGuard } from '../csrf';
import { CSRF_COOKIE } from '../../security/cookieOptions';
import { issueCsrfToken } from '../../security/csrfToken';

describe('csrfGuard', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { method: 'POST', path: '/cart', headers: {}, cookies: {}, user: { userId: 1 } };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any
    };
    next = jest.fn();
  });

  describe('safe methods', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])('calls next() for %s without requiring a token', (method) => {
      req.method = method;
      csrfGuard(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('missing token', () => {
    it('returns 403 JSON error when the X-CSRF-Token header is missing', () => {
      req.cookies = { [CSRF_COOKIE]: 'some-cookie-value' };
      csrfGuard(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'CSRF token inválido' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 JSON error when the CSRF cookie is missing', () => {
      req.headers = { 'x-csrf-token': 'some-header-value' };
      csrfGuard(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'CSRF token inválido' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('mismatched token', () => {
    it('returns 403 when the header value does not match the cookie value', () => {
      const token = issueCsrfToken(1);
      req.cookies = { [CSRF_COOKIE]: token };
      req.headers = { 'x-csrf-token': `${token}-tampered` };
      csrfGuard(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'CSRF token inválido' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('invalid HMAC', () => {
    it('returns 403 when the token was issued for a different userId', () => {
      const token = issueCsrfToken(99);
      req.cookies = { [CSRF_COOKIE]: token };
      req.headers = { 'x-csrf-token': token };
      req.user = { userId: 1 };
      csrfGuard(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'CSRF token inválido' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when req.user is missing (unauthenticated)', () => {
      const token = issueCsrfToken(1);
      req.cookies = { [CSRF_COOKIE]: token };
      req.headers = { 'x-csrf-token': token };
      req.user = undefined;
      csrfGuard(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('valid token', () => {
    it('calls next() when header, cookie, and HMAC all match the authenticated user', () => {
      const token = issueCsrfToken(1);
      req.cookies = { [CSRF_COOKIE]: token };
      req.headers = { 'x-csrf-token': token };
      csrfGuard(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('pre-auth exemptions', () => {
    it.each(['/login', '/register', '/logout', '/users/login', '/users/register', '/users/logout'])(
      'calls next() for POST %s without requiring a token',
      (path) => {
        const exemptReq = { method: 'POST', path, headers: {}, cookies: {}, user: undefined };
        csrfGuard(exemptReq as Request, res as Response, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
      }
    );
  });
});
