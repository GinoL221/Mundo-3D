import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserApiController } from '../UserApiController';
import { AuthenticateUserUseCase } from '../../../application/use-cases/AuthenticateUserUseCase';
import { ListUsersUseCase } from '../../../application/use-cases/ListUsersUseCase';
import { GetUserByIdUseCase } from '../../../application/use-cases/GetUserByIdUseCase';
import { RegisterUserUseCase } from '../../../application/use-cases/RegisterUserUseCase';
import { InvalidCredentialsException } from '../../../domain/exceptions/InvalidCredentialsException';
import { UserAlreadyExistsException } from '../../../domain/exceptions/UserAlreadyExistsException';
import { cleanupUploadedFile } from '../../utils/cleanupUploadedFile';
import { getJwtSecret } from '../../security/JwtSecret';
import {
  AUTH_COOKIE,
  CSRF_COOKIE,
  USER_COOKIE,
  SESSION_MAX_AGE,
  REMEMBER_MAX_AGE,
} from '../../security/cookieOptions';

jest.mock('../../utils/cleanupUploadedFile', () => ({
  cleanupUploadedFile: jest.fn(),
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
      cookie: jest.fn().mockReturnThis() as any,
      clearCookie: jest.fn().mockReturnThis() as any,
      sendStatus: jest.fn().mockReturnThis() as any,
    };
    next = jest.fn();

    (cleanupUploadedFile as jest.Mock).mockClear();
  });

  describe('register', () => {
    it('sets the 3 session cookies and does NOT include a token in the JSON body', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };
      req.file = {
        key: 'users/uuid-1.png',
        location: 'https://pub-test.r2.dev/users/uuid-1.png',
      } as any;

      const mockUserDto = {
        idUser: 123,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        image: 'https://pub-test.r2.dev/users/uuid-1.png',
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
        image: 'https://pub-test.r2.dev/users/uuid-1.png',
      });
      expect(res.status).toHaveBeenCalledWith(201);

      const cookieNames = (res.cookie as jest.Mock).mock.calls.map((call) => call[0]);
      expect(cookieNames).toEqual(
        expect.arrayContaining([AUTH_COOKIE, CSRF_COOKIE, USER_COOKIE])
      );

      const authCookieCall = (res.cookie as jest.Mock).mock.calls.find(
        (call) => call[0] === AUTH_COOKIE
      );
      expect(authCookieCall[2]).toMatchObject({ httpOnly: true, maxAge: SESSION_MAX_AGE });

      expect(res.json).toHaveBeenCalledWith(
        expect.not.objectContaining({ token: expect.anything() })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 if user email is already registered and removes the orphaned upload', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };
      req.file = {
        key: 'users/uuid-1.png',
        location: 'https://pub-test.r2.dev/users/uuid-1.png',
      } as any;

      mockRegisterUserUseCase.execute.mockRejectedValue(
        new UserAlreadyExistsException('Este email ya está registrado')
      );

      await (controller as any).register(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Este email ya está registrado',
      });
      expect(cleanupUploadedFile).toHaveBeenCalledWith('users/uuid-1.png');
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

  describe('login', () => {
    const mockUserDto = {
      idUser: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      image: 'avatar.png',
      idRole: 2,
      category: 'User',
    };

    it('sets 3 Set-Cookie-equivalent res.cookie calls and does NOT include a token in the body', async () => {
      req.body = { email: 'john@example.com', password: 'password123' };
      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockUserDto);

      await (controller as any).login(req as Request, res as Response, next);

      const cookieNames = (res.cookie as jest.Mock).mock.calls.map((call) => call[0]);
      expect(cookieNames).toEqual(
        expect.arrayContaining([AUTH_COOKIE, CSRF_COOKIE, USER_COOKIE])
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.not.objectContaining({ token: expect.anything() })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('issues a 30-day cookie and a matching-exp JWT when remember is true', async () => {
      req.body = { email: 'john@example.com', password: 'password123', remember: true };
      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockUserDto);

      await (controller as any).login(req as Request, res as Response, next);

      const authCookieCall = (res.cookie as jest.Mock).mock.calls.find(
        (call) => call[0] === AUTH_COOKIE
      );
      expect(authCookieCall[2]).toMatchObject({ maxAge: REMEMBER_MAX_AGE });

      const token = authCookieCall[1] as string;
      const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
      const secondsRemaining = (decoded.exp as number) - (decoded.iat as number);
      expect(secondsRemaining).toBe(REMEMBER_MAX_AGE / 1000);
    });

    it('issues a 2h cookie and a matching-exp JWT when remember is omitted', async () => {
      req.body = { email: 'john@example.com', password: 'password123' };
      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockUserDto);

      await (controller as any).login(req as Request, res as Response, next);

      const authCookieCall = (res.cookie as jest.Mock).mock.calls.find(
        (call) => call[0] === AUTH_COOKIE
      );
      expect(authCookieCall[2]).toMatchObject({ maxAge: SESSION_MAX_AGE });

      const token = authCookieCall[1] as string;
      const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
      const secondsRemaining = (decoded.exp as number) - (decoded.iat as number);
      expect(secondsRemaining).toBe(SESSION_MAX_AGE / 1000);
    });

    it('returns 401 and sets no cookies on invalid credentials', async () => {
      req.body = { email: 'john@example.com', password: 'wrong' };
      mockAuthenticateUserUseCase.execute.mockRejectedValue(
        new InvalidCredentialsException('El email o la contraseña no coinciden')
      );

      await (controller as any).login(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the 3 session cookies with byte-identical flags to login and responds 204', async () => {
      req.user = { userId: 1, email: 'john@example.com', category: 'User', idRole: 2 };

      await (controller as any).logout(req as Request, res as Response, next);

      const clearedNames = (res.clearCookie as jest.Mock).mock.calls.map((call) => call[0]);
      expect(clearedNames).toEqual(
        expect.arrayContaining([AUTH_COOKIE, CSRF_COOKIE, USER_COOKIE])
      );

      const authClearOptions = (res.clearCookie as jest.Mock).mock.calls.find(
        (call) => call[0] === AUTH_COOKIE
      )[1];
      expect(authClearOptions).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });

      expect(res.sendStatus).toHaveBeenCalledWith(204);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
