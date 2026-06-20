import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserApiController } from '../UserApiController';
import { AuthenticateUserUseCase } from '../../../application/use-cases/AuthenticateUserUseCase';
import { ListUsersUseCase } from '../../../application/use-cases/ListUsersUseCase';
import { GetUserByIdUseCase } from '../../../application/use-cases/GetUserByIdUseCase';
import { RegisterUserUseCase } from '../../../application/use-cases/RegisterUserUseCase';
import { UserAlreadyExistsException } from '../../../domain/exceptions/UserAlreadyExistsException';
import { validationResult } from 'express-validator';

jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

describe('UserApiController', () => {
  let controller: UserApiController;
  let mockAuthenticateUserUseCase: jest.Mocked<AuthenticateUserUseCase>;
  let mockListUsersUseCase: jest.Mocked<ListUsersUseCase>;
  let mockGetUserByIdUseCase: jest.Mocked<GetUserByIdUseCase>;
  let mockRegisterUserUseCase: jest.Mocked<RegisterUserUseCase>;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockAuthenticateUserUseCase = {
      execute: jest.fn(),
    } as any;
    mockListUsersUseCase = {
      execute: jest.fn(),
    } as any;
    mockGetUserByIdUseCase = {
      execute: jest.fn(),
    } as any;
    mockRegisterUserUseCase = {
      execute: jest.fn(),
    } as any;

    controller = new UserApiController(
      mockAuthenticateUserUseCase,
      mockListUsersUseCase,
      mockGetUserByIdUseCase,
      mockRegisterUserUseCase
    );

    req = {
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    next = jest.fn();

    (validationResult as unknown as jest.Mock).mockReturnValue({
      isEmpty: () => true,
      mapped: () => ({}),
    });
  });

  describe('register', () => {
    it('returns 201 and JWT token on successful registration', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };
      req.file = { filename: 'avatar.png' } as any;

      const mockUserDto = {
        idUser: 123,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        image: 'avatar.png',
        idRole: 2,
        category: 'User',
      };

      mockRegisterUserUseCase.execute.mockResolvedValue(mockUserDto);

      await (controller as any).register(req as Request, res as Response, next);

      expect(mockRegisterUserUseCase.execute).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        image: 'avatar.png',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 Bad Request with validation errors if inputs fail validation', async () => {
      (validationResult as unknown as jest.Mock).mockReturnValue({
        isEmpty: () => false,
        mapped: () => ({
          email: { msg: 'Email inválido' },
        }),
      });

      await (controller as any).register(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: {
          email: { msg: 'Email inválido' },
        },
      });
      expect(mockRegisterUserUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 400 if user email is already registered', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };
      req.file = { filename: 'avatar.png' } as any;

      mockRegisterUserUseCase.execute.mockRejectedValue(
        new UserAlreadyExistsException('Este email ya está registrado')
      );

      await (controller as any).register(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Este email ya está registrado',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 if req.file is missing', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      await (controller as any).register(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Tienes que subir una imagen',
      });
      expect(mockRegisterUserUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
