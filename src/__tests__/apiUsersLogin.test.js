const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../services', () => ({
  UserService: {
    findByEmail: jest.fn(),
    verifyPassword: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
  },
}));

const { UserService } = require('../services');
const apiUsersRouter = require('../routes/api/users');

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
    UserService.findByEmail.mockResolvedValue({
      IDUser: 1,
      Email: 'user@test.com',
      PasswordUser: 'hashedPassword',
      Category: 'User',
      IDRole: 2,
    });
    UserService.verifyPassword.mockReturnValue(true);

    const res = await request(app)
      .post('/api/users/login')
      .send({ Email: 'user@test.com', Password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    const decoded = jwt.verify(res.body.token, JWT_SECRET);
    expect(decoded).toMatchObject({
      userID: 1,
      Email: 'user@test.com',
      Category: 'User',
      IDRole: 2,
    });

    expect(UserService.findByEmail).toHaveBeenCalledWith('user@test.com', {
      includePassword: true,
    });
  });

  it('returns 401 with an error message when the user does not exist', async () => {
    UserService.findByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/users/login')
      .send({ Email: 'missing@test.com', Password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 with an error message when the password does not match', async () => {
    UserService.findByEmail.mockResolvedValue({
      IDUser: 1,
      Email: 'user@test.com',
      PasswordUser: 'hashedPassword',
      Category: 'User',
      IDRole: 2,
    });
    UserService.verifyPassword.mockReturnValue(false);

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
    expect(UserService.findAll).not.toHaveBeenCalled();
  });

  it('returns 401 on GET /api/users/:id without an Authorization header', async () => {
    const res = await request(app).get('/api/users/1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(UserService.findById).not.toHaveBeenCalled();
  });

  it('allows GET /api/users with a valid Bearer token', async () => {
    UserService.findAll.mockResolvedValue([]);
    const token = jwt.sign(
      { userID: 1, Email: 'admin@test.com', Category: 'Admin', IDRole: 1 },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(UserService.findAll).toHaveBeenCalledTimes(1);
  });
});
