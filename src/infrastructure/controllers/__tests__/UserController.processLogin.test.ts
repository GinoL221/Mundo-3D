import { Request, Response, NextFunction } from 'express';
import { UserController } from '../UserController';

describe('UserController.processLogin — session role data', () => {
  const buildController = (authenticateUserExecute: jest.Mock) => {
    const authenticateUserUseCase = { execute: authenticateUserExecute } as any;
    const registerUserUseCase = {} as any;
    const createRememberTokenUseCase = { execute: jest.fn() } as any;
    const deleteRememberTokenUseCase = {} as any;

    return new UserController(
      authenticateUserUseCase,
      registerUserUseCase,
      createRememberTokenUseCase,
      deleteRememberTokenUseCase,
    );
  };

  const buildReqResNext = () => {
    const req = {
      body: { email: 'admin@test.com', password: 'password123' },
      session: {},
    } as unknown as Request & { session: any };
    const res = {
      render: jest.fn(),
      redirect: jest.fn(),
      cookie: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;
    return { req, res, next };
  };

  it('includes IDRole and Category in req.session.userLogged on successful login', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      IDUser: 1,
      FirstName: 'Admin',
      LastName: 'User',
      Email: 'admin@test.com',
      Image: 'admin.png',
      IDRole: 1,
      Category: 'Admin',
    });

    const controller = buildController(mockExecute);
    const { req, res, next } = buildReqResNext();

    // express-validator's validationResult expects req to be shaped correctly;
    // since no validators are registered in this isolated unit test, errors will be empty.
    await controller.processLogin(req as any, res, next);

    expect((req as any).session.userLogged).toMatchObject({
      IDUser: 1,
      Email: 'admin@test.com',
      IDRole: 1,
      Category: 'Admin',
    });
    expect(res.redirect).toHaveBeenCalledWith('profile');
  });

  it('includes IDRole and Category for a standard user as well', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      IDUser: 2,
      FirstName: 'John',
      LastName: 'Doe',
      Email: 'john@test.com',
      Image: 'john.png',
      IDRole: 2,
      Category: 'User',
    });

    const controller = buildController(mockExecute);
    const { req, res, next } = buildReqResNext();

    await controller.processLogin(req as any, res, next);

    expect((req as any).session.userLogged).toMatchObject({
      IDUser: 2,
      Email: 'john@test.com',
      IDRole: 2,
      Category: 'User',
    });
  });
});
