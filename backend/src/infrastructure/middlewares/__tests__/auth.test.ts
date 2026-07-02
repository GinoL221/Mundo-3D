import jwt from 'jsonwebtoken';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import {
  isUser,
  guestMiddleware,
  authMiddleware,
  apiAuthMiddleware,
  adminGuard,
  requireRoles
} from '../auth';
import { getJwtSecret } from '../../security/JwtSecret';
import { Role } from '../../../domain/Role';

jest.mock('../../security/JwtSecret', () => ({
  getJwtSecret: jest.fn(() => 'test-only-jwt-secret-not-for-production'),
}));

const JWT_SECRET = getJwtSecret();

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

describe('requireRoles', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { path: '/api/products', session: {} };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any
    };
    next = jest.fn();
  });

  it('returns 401 JSON error when there is no principal (no session, no req.user)', () => {
    const guard = requireRoles(Role.ADMIN, Role.STAFF);
    guard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Autenticación requerida' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 JSON error when the authenticated role is not in the allow-list', () => {
    req.user = { userId: 2, email: 'user@test.com', category: 'User', idRole: Role.USER };
    const guard = requireRoles(Role.ADMIN, Role.STAFF);
    guard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acceso restringido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the authenticated role is in the allow-list', () => {
    req.user = { userId: 3, email: 'staff@test.com', category: 'Staff', idRole: Role.STAFF };
    const guard = requireRoles(Role.ADMIN, Role.STAFF);
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('accepts the principal from req.session.userLogged when present', () => {
    req.session!.userLogged = { idUser: 1, firstName: 'Admin', lastName: 'User', email: 'admin@test.com', image: null, idRole: Role.ADMIN, category: 'Admin' };
    const guard = requireRoles(Role.ADMIN);
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects a single-role allow-list when the role does not match', () => {
    req.user = { userId: 3, email: 'staff@test.com', category: 'Staff', idRole: Role.STAFF };
    const guard = requireRoles(Role.ADMIN);
    guard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('adminGuard (alias for requireRoles(Role.ADMIN))', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { path: '/api/users', session: {} };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any
    };
    next = jest.fn();
  });

  it('returns 401 JSON error for non-authenticated requests', () => {
    adminGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Autenticación requerida' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 JSON error for authenticated requests if role is not admin', () => {
    req.user = { userId: 2, email: 'user@test.com', category: 'User', idRole: Role.USER };
    adminGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acceso restringido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 JSON error for authenticated STAFF requests (admin-only route)', () => {
    req.user = { userId: 3, email: 'staff@test.com', category: 'Staff', idRole: Role.STAFF };
    adminGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for admin requests (Role.ADMIN)', () => {
    req.user = { userId: 1, email: 'admin@test.com', category: 'Admin', idRole: Role.ADMIN };
    adminGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
