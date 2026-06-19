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

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

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
