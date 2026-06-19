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

  it('includes idUser and category in req.session.userLogged on successful login', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      idUser: 1,
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      image: 'admin.png',
      idRole: 1,
      category: 'Admin',
    });

    const controller = buildController(mockExecute);
    const { req, res, next } = buildReqResNext();

    // express-validator's validationResult expects req to be shaped correctly;
    // since no validators are registered in this isolated unit test, errors will be empty.
    await controller.processLogin(req as any, res, next);

    expect((req as any).session.userLogged).toMatchObject({
      idUser: 1,
      email: 'admin@test.com',
      idRole: 1,
      category: 'Admin',
    });
    expect(res.redirect).toHaveBeenCalledWith('profile');
  });

  it('includes idRole and category for a standard user as well', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      idUser: 2,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      image: 'john.png',
      idRole: 2,
      category: 'User',
    });

    const controller = buildController(mockExecute);
    const { req, res, next } = buildReqResNext();

    await controller.processLogin(req as any, res, next);

    expect((req as any).session.userLogged).toMatchObject({
      idUser: 2,
      email: 'john@test.com',
      idRole: 2,
      category: 'User',
    });
  });
});
