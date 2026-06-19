const jwt = require('jsonwebtoken');
const { apiAuthMiddleware, adminGuard } = require('../infrastructure/middlewares/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

describe('apiAuthMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('returns 401 when no Authorization header is provided', () => {
    apiAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not use the Bearer scheme', () => {
    req.headers.authorization = 'Basic abc123';

    apiAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is invalid or malformed', () => {
    req.headers.authorization = 'Bearer not-a-valid-token';

    apiAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is expired', () => {
    const expiredToken = jwt.sign(
      { userId: 1, email: 'user@test.com', category: 'User', idRole: 2 },
      JWT_SECRET,
      { expiresIn: -10 },
    );
    req.headers.authorization = `Bearer ${expiredToken}`;

    apiAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches decoded payload to req.user and calls next() when the token is valid', () => {
    const payload = { userId: 1, email: 'user@test.com', category: 'User', idRole: 2 };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    req.headers.authorization = `Bearer ${token}`;

    apiAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject(payload);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('adminGuard', () => {
  let req, res, next;

  beforeEach(() => {
    req = { path: '/', headers: {}, session: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
      render: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('redirects guest (web) requests without a session to /login', () => {
    adminGuard(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 JSON for guest API requests (path starts with /api)', () => {
    req.path = '/api/users';

    adminGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for an authenticated non-admin web session (idRole !== 1)', () => {
    req.session.userLogged = { idUser: 2, idRole: 2, category: 'User' };

    adminGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 JSON for an authenticated non-admin API request (req.user.idRole !== 1)', () => {
    req.path = '/api/users';
    req.user = { userId: 2, idRole: 2, category: 'User' };

    adminGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for an authenticated admin web session (idRole === 1)', () => {
    req.session.userLogged = { idUser: 1, idRole: 1, category: 'Admin' };

    adminGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() for an authenticated admin API request (req.user.idRole === 1)', () => {
    req.path = '/api/users';
    req.user = { userId: 1, idRole: 1, category: 'Admin' };

    adminGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
