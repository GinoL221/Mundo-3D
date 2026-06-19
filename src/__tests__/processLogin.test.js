jest.mock('../application/use-cases/AuthenticateUserUseCase', () => {
  return {
    AuthenticateUserUseCase: jest.fn().mockImplementation(() => {
      return {
        execute: async (input) => {
          const { UserService } = require('../services');
          const user = await UserService.findByEmail(input.email, { includePassword: true });
          if (!user || !UserService.verifyPassword(input.password || input.passwordUser, user.PasswordUser)) {
            const { InvalidCredentialsException } = require('../domain/exceptions/InvalidCredentialsException');
            throw new InvalidCredentialsException('El email o la contraseña no coinciden');
          }
          return {
            idUser: user.idUser || user.IDUser,
            firstName: user.firstName || user.FirstName,
            lastName: user.lastName || user.LastName,
            email: user.email || user.Email,
            image: user.image || user.Image,
          };
        },
      };
    }),
  };
});

jest.mock('../application/use-cases/CreateRememberTokenUseCase', () => {
  return {
    CreateRememberTokenUseCase: jest.fn().mockImplementation(() => {
      return {
        execute: async (input) => {
          const { UserService } = require('../services');
          return UserService.createRememberToken(input.idUser, input.plainToken, input.durationSeconds);
        },
      };
    }),
  };
});

const { UserService } = require('../services');

jest.mock('../services', () => ({
  UserService: {
    findByEmail: jest.fn(),
    verifyPassword: jest.fn(),
    createRememberToken: jest.fn(),
  },
}));

jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

const processLogin = require('../controllers/users/processLogin');
const { validationResult } = require('express-validator');

describe('processLogin controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
      session: {},
    };
    res = {
      cookie: jest.fn(),
      redirect: jest.fn(),
      render: jest.fn(),
    };
    next = jest.fn();

    // Default validationResult is empty (no errors)
    validationResult.mockReturnValue({
      isEmpty: () => true,
    });
  });

  describe('Validation Errors', () => {
    it('renders login view with validation errors when request validation fails', async () => {
      validationResult.mockReturnValue({
        isEmpty: () => false,
        mapped: () => ({
          email: { msg: 'Email inválido' },
        }),
      });

      await processLogin(req, res, next);

      expect(res.render).toHaveBeenCalledWith('users/login', {
        errors: { email: { msg: 'Email inválido' } },
        oldData: 'test@example.com',
      });
      expect(req.session.userLogged).toBeUndefined();
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('Credential Validation', () => {
    it('redirects to profile and does NOT set remember cookie when login succeeds without remember checked', async () => {
      const mockUser = {
        idUser: 42,
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        PasswordUser: 'hashedPassword',
        image: 'john.png',
      };
      UserService.findByEmail.mockResolvedValue(mockUser);
      UserService.verifyPassword.mockReturnValue(true);

      req.body.remember = false;

      await processLogin(req, res, next);

      expect(req.session.userLogged).toEqual({
        idUser: 42,
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        image: 'john.png',
      });
      expect(res.redirect).toHaveBeenCalledWith('profile');
      expect(res.cookie).not.toHaveBeenCalled();
      expect(UserService.createRememberToken).not.toHaveBeenCalled();
    });

    it('creates remember token, sets signed cookie, and redirects when login succeeds with remember checked', async () => {
      const mockUser = {
        idUser: 42,
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        PasswordUser: 'hashedPassword',
        image: 'john.png',
      };
      UserService.findByEmail.mockResolvedValue(mockUser);
      UserService.verifyPassword.mockReturnValue(true);
      UserService.createRememberToken.mockResolvedValue({ id: 1 });

      req.body.remember = true;

      await processLogin(req, res, next);

      expect(req.session.userLogged).toEqual({
        idUser: 42,
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        image: 'john.png',
      });
      expect(res.redirect).toHaveBeenCalledWith('profile');
      expect(UserService.createRememberToken).toHaveBeenCalledWith(
        42,
        expect.any(String),
        30 * 24 * 60 * 60
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'remember_token',
        expect.stringMatching(/^42:[a-f0-9]{64}$/),
        expect.objectContaining({
          maxAge: 30 * 24 * 60 * 60 * 1000,
          signed: true,
          httpOnly: true,
          secure: false, // development environment
          sameSite: 'lax',
        })
      );
    });

    it('renders invalid credentials error helper when password does not match', async () => {
      const mockUser = {
        idUser: 42,
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        PasswordUser: 'hashedPassword',
      };
      UserService.findByEmail.mockResolvedValue(mockUser);
      UserService.verifyPassword.mockReturnValue(false);

      await processLogin(req, res, next);

      expect(req.session.userLogged).toBeUndefined();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('users/login', {
        errors: {
          email: { msg: 'El email o la contraseña no coinciden' },
          password: { msg: 'El email o la contraseña no coinciden' },
        },
        oldData: 'test@example.com',
      });
    });

    it('renders invalid credentials error helper when user is not found', async () => {
      UserService.findByEmail.mockResolvedValue(null);

      await processLogin(req, res, next);

      expect(req.session.userLogged).toBeUndefined();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.render).toHaveBeenCalledWith('users/login', {
        errors: {
          email: { msg: 'El email o la contraseña no coinciden' },
          password: { msg: 'El email o la contraseña no coinciden' },
        },
        oldData: 'test@example.com',
      });
    });
  });
});
