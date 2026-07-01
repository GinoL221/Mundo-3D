const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const mockAuthenticateUserExecute = jest.fn();
const mockListUsersExecute = jest.fn();
const mockGetUserByIdExecute = jest.fn();

jest.mock('../application/use-cases/AuthenticateUserUseCase', () => {
  return {
    AuthenticateUserUseCase: jest.fn().mockImplementation(() => ({
      execute: mockAuthenticateUserExecute,
    })),
  };
});

jest.mock('../application/use-cases/ListUsersUseCase', () => {
  return {
    ListUsersUseCase: jest.fn().mockImplementation(() => ({
      execute: mockListUsersExecute,
    })),
  };
});

jest.mock('../application/use-cases/GetUserByIdUseCase', () => {
  return {
    GetUserByIdUseCase: jest.fn().mockImplementation(() => ({
      execute: mockGetUserByIdExecute,
    })),
  };
});

const apiUsersRouter = require('../infrastructure/routes/api/users').default;
const { getJwtSecret } = require('../infrastructure/security/JwtSecret');

const JWT_SECRET = getJwtSecret();

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiUsersRouter);
  return app;
};

describe('POST /api/users/login', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 200 with a signed JWT token on successful login', async () => {
    mockAuthenticateUserExecute.mockResolvedValue({
      idUser: 1,
      email: 'user@test.com',
      category: 'User',
      idRole: 2,
    });

    const res = await request(app)
      .post('/api/users/login')
      .send({ Email: 'user@test.com', Password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    const decoded = jwt.verify(res.body.token, JWT_SECRET);
    expect(decoded).toMatchObject({
      userId: 1,
      email: 'user@test.com',
      category: 'User',
      idRole: 2,
    });

    expect(mockAuthenticateUserExecute).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123',
    });
  });

  it('returns 401 with an error message when the user does not exist', async () => {
    const { InvalidCredentialsException } = require('../domain/exceptions/InvalidCredentialsException');
    mockAuthenticateUserExecute.mockRejectedValue(new InvalidCredentialsException('El email o la contraseña no coinciden'));

    const res = await request(app)
      .post('/api/users/login')
      .send({ Email: 'missing@test.com', Password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 with an error message when the password does not match', async () => {
    const { InvalidCredentialsException } = require('../domain/exceptions/InvalidCredentialsException');
    mockAuthenticateUserExecute.mockRejectedValue(new InvalidCredentialsException('El email o la contraseña no coinciden'));

    const res = await request(app)
      .post('/api/users/login')
      .send({ Email: 'user@test.com', Password: 'wrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});

describe('normalizeLoginBody (Email/Password casing normalization)', () => {
  // This describe block issues more login attempts than loginLimiter's
  // default max (5 per window), and the limiter is a module-level singleton
  // shared across every `request(app)` call in this file. Reset the module
  // registry with a bumped LOGIN_LIMIT_MAX so these tests don't trip the
  // rate limiter and get false 429s instead of exercising normalizeLoginBody.
  let app;
  let freshRouter;

  beforeAll(() => {
    process.env.LOGIN_LIMIT_MAX = '20';
    jest.resetModules();
    freshRouter = require('../infrastructure/routes/api/users').default;
  });

  afterAll(() => {
    delete process.env.LOGIN_LIMIT_MAX;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api', freshRouter);
  });

  it('normalizes capitalized Email/Password into lowercase email/password', async () => {
    mockAuthenticateUserExecute.mockResolvedValue({
      idUser: 1,
      email: 'user@test.com',
      category: 'User',
      idRole: 2,
    });

    await request(app)
      .post('/api/users/login')
      .send({ Email: 'user@test.com', Password: 'password123' });

    expect(mockAuthenticateUserExecute).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123',
    });
  });

  it('passes lowercase email/password through unchanged when no capitalized fields are sent', async () => {
    mockAuthenticateUserExecute.mockResolvedValue({
      idUser: 1,
      email: 'lower@test.com',
      category: 'User',
      idRole: 2,
    });

    await request(app)
      .post('/api/users/login')
      .send({ email: 'lower@test.com', password: 'password123' });

    expect(mockAuthenticateUserExecute).toHaveBeenCalledWith({
      email: 'lower@test.com',
      password: 'password123',
    });
  });

  it('prefers the capitalized field when both casings are present (controller-level fallback wins)', async () => {
    // NOTE: normalizeLoginBody itself only copies Email/Password into
    // email/password when the lowercase field is ABSENT (`!req.body.email`),
    // so when both are sent it leaves req.body.email untouched. But
    // UserApiController.login independently re-derives the credentials via
    // `req.body.Email || req.body.email`, which prefers the capitalized
    // field. That controller-level extraction is what actually determines
    // the value passed to AuthenticateUserUseCase, so capitalized wins
    // end-to-end. This is a pre-existing double-normalization inconsistency
    // (two layers disagree on precedence) — documented here, not fixed,
    // since both fields being sent simultaneously is not a real client
    // scenario today and fixing it would mean touching the controller too.
    mockAuthenticateUserExecute.mockResolvedValue({
      idUser: 1,
      email: 'capitalized@test.com',
      category: 'User',
      idRole: 2,
    });

    await request(app).post('/api/users/login').send({
      Email: 'capitalized@test.com',
      email: 'lower@test.com',
      Password: 'capitalizedPass1',
      password: 'lowerPassword1',
    });

    expect(mockAuthenticateUserExecute).toHaveBeenCalledWith({
      email: 'capitalized@test.com',
      password: 'capitalizedPass1',
    });
  });

  it('returns a validation error instead of crashing when no credentials are sent at all', async () => {
    const res = await request(app).post('/api/users/login').send({});

    expect(res.status).toBe(400);
    expect(mockAuthenticateUserExecute).not.toHaveBeenCalled();
  });
});

describe('apiAuthMiddleware mounted on /api/users routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 401 on GET /api/users without an Authorization header', async () => {
    const res = await request(app).get('/api/users');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(mockListUsersExecute).not.toHaveBeenCalled();
  });

  it('returns 401 on GET /api/users/:id without an Authorization header', async () => {
    const res = await request(app).get('/api/users/1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(mockGetUserByIdExecute).not.toHaveBeenCalled();
  });

  it('allows GET /api/users with a valid Bearer token', async () => {
    mockListUsersExecute.mockResolvedValue([]);
    const token = jwt.sign(
      { userId: 1, email: 'admin@test.com', category: 'Admin', idRole: 1 },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockListUsersExecute).toHaveBeenCalledTimes(1);
  });
});
