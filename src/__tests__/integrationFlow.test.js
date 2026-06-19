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

jest.mock('../application/use-cases/VerifyRememberTokenUseCase', () => {
  return {
    VerifyRememberTokenUseCase: jest.fn().mockImplementation(() => {
      return {
        execute: async (plainToken) => {
          const { UserService } = require('../services');
          return UserService.verifyRememberToken(plainToken);
        },
      };
    }),
  };
});

jest.mock('../application/use-cases/DeleteRememberTokenUseCase', () => {
  return {
    DeleteRememberTokenUseCase: jest.fn().mockImplementation(() => {
      return {
        execute: async (plainToken) => {
          const { UserService } = require('../services');
          return UserService.deleteRememberToken(plainToken);
        },
      };
    }),
  };
});

const processLogin = require('../controllers/users/processLogin');
const userLoggedMiddleware = require('../middlewares/userLogged');
const logout = require('../controllers/users/logout');
const { validationResult } = require('express-validator');

// Mock UserService
jest.mock('../services', () => {
  const mockTokens = {};
  const mockUsers = {
    42: { idUser: 42, firstName: 'John', lastName: 'Doe', email: 'john@test.com', PasswordUser: 'hashed_password' },
  };

  return {
    UserService: {
      findByEmail: jest.fn(async (email) => {
        return Object.values(mockUsers).find(u => u.email === email) || null;
      }),
      verifyPassword: jest.fn((plain, hash) => plain === 'password123'),
      findById: jest.fn(async (id) => mockUsers[id] || null),
      createRememberToken: jest.fn(async (userId, plainToken, duration) => {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(plainToken).digest('hex');
        mockTokens[hash] = { idUser: userId, ExpiresAt: new Date(Date.now() + duration * 1000) };
        return { id: 123, idUser: userId, tokenHash: hash };
      }),
      verifyRememberToken: jest.fn(async (plainToken) => {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(plainToken).digest('hex');
        const record = mockTokens[hash];
        if (!record) return null;
        if (new Date() > record.ExpiresAt) {
          delete mockTokens[hash];
          return null;
        }
        return mockUsers[record.idUser] || null;
      }),
      deleteRememberToken: jest.fn(async (plainToken) => {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(plainToken).digest('hex');
        if (mockTokens[hash]) {
          delete mockTokens[hash];
          return 1;
        }
        return 0;
      }),
    },
  };
});

jest.mock('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
  })),
}));

describe('Remember-Me Authentication Flow Integration', () => {
  let session, cookies, signedCookies, res;

  beforeEach(() => {
    session = {};
    cookies = {};
    signedCookies = {};
    res = {
      cookie: jest.fn((name, value, options) => {
        if (options && options.signed) {
          signedCookies[name] = value;
        } else {
          cookies[name] = value;
        }
      }),
      clearCookie: jest.fn((name) => {
        delete cookies[name];
        delete signedCookies[name];
      }),
      redirect: jest.fn(),
      render: jest.fn(),
    };
  });

  it('completes full cycle: login -> middleware auto-login -> logout', async () => {
    // 1. LOGIN WITH REMEMBER-ME
    const loginReq = {
      body: {
        email: 'john@test.com',
        password: 'password123',
        remember: true,
      },
      session,
    };

    await processLogin(loginReq, res, jest.fn());

    // Expect session to be set and signed cookie to be created
    expect(session.userLogged).toBeDefined();
    expect(session.userLogged.idUser).toBe(42);
    expect(signedCookies.remember_token).toBeDefined();
    expect(signedCookies.remember_token).toContain('42:');

    // Extract raw plainToken
    const plainToken = signedCookies.remember_token.split(':')[1];

    const subsequentSession = {
      destroy: jest.fn((callback) => callback(null)),
    };
    const middlewareReq = {
      cookies,
      signedCookies,
      session: subsequentSession,
    };
    const middlewareRes = {
      locals: {},
      clearCookie: res.clearCookie,
    };
    const nextMock = jest.fn();

    await userLoggedMiddleware(middlewareReq, middlewareRes, nextMock);

    // Expect middleware to automatically log in the user and populate session and locals
    expect(subsequentSession.userLogged).toBeDefined();
    expect(subsequentSession.userLogged.idUser).toBe(42);
    expect(middlewareRes.locals.isLogged).toBe(true);
    expect(middlewareRes.locals.userLogged.idUser).toBe(42);
    expect(nextMock).toHaveBeenCalled();

    // 3. LOGOUT (clears cookie & deletes token from DB)
    const logoutReq = {
      cookies,
      signedCookies,
      session: subsequentSession,
    };

    await logout(logoutReq, res);

    // Expect cookie to be cleared and redirect to home
    expect(signedCookies.remember_token).toBeUndefined();
    expect(res.clearCookie).toHaveBeenCalledWith('remember_token');

    // 4. ANOTHER MIDDLEWARE ACCESS (cookie is cleared, should NOT login anymore)
    const emptySession = {};
    const finalReq = {
      cookies: {},
      signedCookies: {},
      session: emptySession,
    };
    const finalRes = {
      locals: {},
      clearCookie: jest.fn(),
    };

    await userLoggedMiddleware(finalReq, finalRes, nextMock);

    expect(emptySession.userLogged).toBeUndefined();
    expect(finalRes.locals.isLogged).toBe(false);
  });
});
