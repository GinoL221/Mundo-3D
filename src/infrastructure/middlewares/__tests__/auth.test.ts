import jwt from 'jsonwebtoken';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import {
  isUser,
  guestMiddleware,
  authMiddleware,
  apiAuthMiddleware,
  adminGuard
} from '../auth';

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

describe('isUser middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      locals: {},
      redirect: jest.fn() as any
    };
    next = jest.fn();
  });

  it('calls next() if user is logged (res.locals.isLogged is true)', () => {
    res.locals!.isLogged = true;
    isUser(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('redirects to /login if user is not logged', () => {
    res.locals!.isLogged = false;
    isUser(req as Request, res as Response, next);
    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('guestMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      session: {}
    };
    res = {
      redirect: jest.fn() as any
    };
    next = jest.fn();
  });

  it('redirects to /profile if userLogged is in session', () => {
    req.session!.userLogged = { idUser: 1, email: 'user@test.com', firstName: 'John', lastName: 'Doe', image: null, idRole: 2, category: 'User' };
    guestMiddleware(req as Request, res as Response, next);
    expect(res.redirect).toHaveBeenCalledWith('/profile');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() if no userLogged in session', () => {
    guestMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});

describe('authMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      session: {}
    };
    res = {
      redirect: jest.fn() as any
    };
    next = jest.fn();
  });

  it('redirects to /login if userLogged is NOT in session', () => {
    authMiddleware(req as Request, res as Response, next);
    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() if userLogged is in session', () => {
    req.session!.userLogged = { idUser: 1, email: 'user@test.com', firstName: 'John', lastName: 'Doe', image: null, idRole: 2, category: 'User' };
    authMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});

describe('apiAuthMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any
    };
    next = jest.fn();
  });

  it('returns 401 JSON error when authorization header is missing', () => {
    apiAuthMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticación no proporcionado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 JSON error when authorization scheme is not Bearer', () => {
    req.headers!.authorization = 'Basic token123';
    apiAuthMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticación no proporcionado' });
  });

  it('returns 401 JSON error when token is invalid or expired', () => {
    req.headers!.authorization = 'Bearer invalid-token-value';
    apiAuthMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticación inválido o expirado' });
  });

  it('attaches payload to req.user and calls next() on valid token', () => {
    const payload = { userId: 1, email: 'user@test.com', category: 'User', idRole: 2 };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
    req.headers!.authorization = `Bearer ${token}`;

    apiAuthMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject(payload);
  });
});

describe('adminGuard', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { path: '/admin', session: {} };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
      redirect: jest.fn() as any,
      render: jest.fn().mockReturnThis() as any
    };
    next = jest.fn();
  });

  it('redirects to /login for non-authenticated web requests', () => {
    adminGuard(req as Request, res as Response, next);
    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 JSON error for non-authenticated API requests', () => {
    (req as any).path = '/api/users';
    adminGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Autenticación requerida' });
  });

  it('returns 401 JSON error for non-authenticated API requests where path does not start with /api but originalUrl does', () => {
    (req as any).path = '/users';
    (req as any).originalUrl = '/api/users';
    adminGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Autenticación requerida' });
  });

  it('returns 403 JSON error for authenticated API requests if role is not admin', () => {
    (req as any).path = '/api/users';
    req.user = { userId: 2, email: 'user@test.com', category: 'User', idRole: 2 };
    adminGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acceso restringido a administradores' });
  });

  it('renders 403Forbidden page for authenticated web requests if role is not admin', () => {
    req.session!.userLogged = { idUser: 2, firstName: 'John', lastName: 'Doe', email: 'user@test.com', image: null, idRole: 2, category: 'User' };
    adminGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.render).toHaveBeenCalledWith(expect.stringContaining('403Forbidden.ejs'), expect.any(Object));
  });

  it('calls next() for admin web sessions (role 1)', () => {
    req.session!.userLogged = { idUser: 1, firstName: 'Admin', lastName: 'User', email: 'admin@test.com', image: null, idRole: 1, category: 'Admin' };
    adminGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('calls next() for admin API requests (role 1)', () => {
    (req as any).path = '/api/users';
    req.user = { userId: 1, email: 'admin@test.com', category: 'Admin', idRole: 1 };
    adminGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
