const userLoggedMiddleware = require('../middlewares/userLogged');
const { UserService } = require('../services');

// Mock UserService
jest.mock('../services', () => ({
  UserService: {
    findByEmail: jest.fn(),
  },
}));

describe('userLoggedMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      cookies: {},
      session: {},
    };
    res = {
      locals: {},
    };
    next = jest.fn();
  });

  describe('cookie-based user lookup', () => {
    it('calls UserService.findByEmail when userEmail cookie exists', async () => {
      req.cookies.userEmail = 'test@example.com';
      const mockUser = { IDUser: 1, Email: 'test@example.com', FirstName: 'Test' };
      UserService.findByEmail.mockResolvedValue(mockUser);

      await userLoggedMiddleware(req, res, next);

      expect(UserService.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('attaches user to res.locals.userLogged when found via cookie', async () => {
      req.cookies.userEmail = 'test@example.com';
      const mockUser = { IDUser: 1, Email: 'test@example.com', FirstName: 'Test' };
      UserService.findByEmail.mockResolvedValue(mockUser);

      await userLoggedMiddleware(req, res, next);

      expect(res.locals.userLogged).toEqual(mockUser);
    });

    it('does not attach user when cookie user not found', async () => {
      req.cookies.userEmail = 'nonexistent@example.com';
      UserService.findByEmail.mockResolvedValue(null);

      await userLoggedMiddleware(req, res, next);

      expect(res.locals.userLogged).toBeUndefined();
    });

    it('does not call UserService when no cookies exist', async () => {
      req.cookies = {};

      await userLoggedMiddleware(req, res, next);

      expect(UserService.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('session-based user lookup', () => {
    it('sets isLogged true and attaches user when session has userLogged', async () => {
      req.session.userLogged = { IDUser: 2, FirstName: 'SessionUser' };

      await userLoggedMiddleware(req, res, next);

      expect(res.locals.isLogged).toBe(true);
      expect(res.locals.userLogged).toEqual(req.session.userLogged);
    });

    it('session user overrides cookie user', async () => {
      req.cookies.userEmail = 'cookie@example.com';
      const cookieUser = { IDUser: 1, Email: 'cookie@example.com' };
      const sessionUser = { IDUser: 2, FirstName: 'SessionUser' };
      UserService.findByEmail.mockResolvedValue(cookieUser);
      req.session.userLogged = sessionUser;

      await userLoggedMiddleware(req, res, next);

      expect(res.locals.isLogged).toBe(true);
      expect(res.locals.userLogged).toEqual(sessionUser);
    });
  });

  describe('default behavior', () => {
    it('sets isLogged false when no session user and no cookie user', async () => {
      await userLoggedMiddleware(req, res, next);

      expect(res.locals.isLogged).toBe(false);
    });

    it('calls next()', async () => {
      await userLoggedMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
