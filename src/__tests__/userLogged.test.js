const userLoggedMiddleware = require('../middlewares/userLogged');
const { UserService } = require('../services');

// Mock UserService
jest.mock('../services', () => ({
  UserService: {
    findByEmail: jest.fn(),
    verifyRememberToken: jest.fn(),
  },
}));

describe('userLoggedMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      cookies: {},
      signedCookies: {},
      session: {},
    };
    res = {
      locals: {},
      clearCookie: jest.fn(),
    };
    next = jest.fn();
  });

  describe('session-based user lookup', () => {
    it('sets isLogged true and attaches user when session has userLogged', async () => {
      req.session.userLogged = { IDUser: 2, FirstName: 'SessionUser' };

      await userLoggedMiddleware(req, res, next);

      expect(res.locals.isLogged).toBe(true);
      expect(res.locals.userLogged).toEqual(req.session.userLogged);
      expect(UserService.verifyRememberToken).not.toHaveBeenCalled();
    });
  });

  describe('signed cookie remember-me authentication', () => {
    it('authenticates user and sets session when remember_token is valid and matching', async () => {
      req.signedCookies.remember_token = '42:plain_token_abc';
      const mockUser = { IDUser: 42, FirstName: 'John', Email: 'john@test.com' };
      UserService.verifyRememberToken.mockResolvedValue(mockUser);

      await userLoggedMiddleware(req, res, next);

      expect(UserService.verifyRememberToken).toHaveBeenCalledWith('plain_token_abc');
      expect(req.session.userLogged).toEqual(mockUser);
      expect(res.locals.isLogged).toBe(true);
      expect(res.locals.userLogged).toEqual(mockUser);
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it('clears cookie and does not log in user when IDUser does not match cookie', async () => {
      req.signedCookies.remember_token = '99:plain_token_abc';
      const mockUser = { IDUser: 42, FirstName: 'John', Email: 'john@test.com' };
      UserService.verifyRememberToken.mockResolvedValue(mockUser);

      await userLoggedMiddleware(req, res, next);

      expect(UserService.verifyRememberToken).toHaveBeenCalledWith('plain_token_abc');
      expect(req.session.userLogged).toBeUndefined();
      expect(res.locals.isLogged).toBe(false);
      expect(res.clearCookie).toHaveBeenCalledWith('remember_token');
    });

    it('clears cookie and does not log in user when token is invalid/expired', async () => {
      req.signedCookies.remember_token = '42:expired_token';
      UserService.verifyRememberToken.mockResolvedValue(null);

      await userLoggedMiddleware(req, res, next);

      expect(UserService.verifyRememberToken).toHaveBeenCalledWith('expired_token');
      expect(req.session.userLogged).toBeUndefined();
      expect(res.locals.isLogged).toBe(false);
      expect(res.clearCookie).toHaveBeenCalledWith('remember_token');
    });

    it('clears cookie when cookie signature is invalid (cookie in req.cookies but not req.signedCookies)', async () => {
      req.cookies.remember_token = 'invalid_signature_cookie';

      await userLoggedMiddleware(req, res, next);

      expect(UserService.verifyRememberToken).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('remember_token');
      expect(res.locals.isLogged).toBe(false);
    });

    it('does nothing when no remember_token cookies exist', async () => {
      await userLoggedMiddleware(req, res, next);

      expect(UserService.verifyRememberToken).not.toHaveBeenCalled();
      expect(res.clearCookie).not.toHaveBeenCalled();
      expect(res.locals.isLogged).toBe(false);
    });
  });

  describe('default behavior', () => {
    it('calls next() in all paths', async () => {
      await userLoggedMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
