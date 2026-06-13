const logout = require('../controllers/users/logout');
const { UserService } = require('../services');

jest.mock('../services', () => ({
  UserService: {
    deleteRememberToken: jest.fn(),
  },
}));

describe('logout controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      cookies: {},
      signedCookies: {},
      session: {
        destroy: jest.fn((callback) => callback(null)),
      },
    };
    res = {
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    };
  });

  it('clears remember_token cookie and deletes token in DB if remember_token exists', async () => {
    req.signedCookies.remember_token = '42:plain_token_xyz';
    UserService.deleteRememberToken.mockResolvedValue(1);

    await logout(req, res);

    expect(UserService.deleteRememberToken).toHaveBeenCalledWith('plain_token_xyz');
    expect(res.clearCookie).toHaveBeenCalledWith('remember_token');
    expect(req.session.destroy).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('clears remember_token cookie and does not call DB delete if no remember_token cookie exists', async () => {
    await logout(req, res);

    expect(UserService.deleteRememberToken).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith('remember_token');
    expect(req.session.destroy).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });
});
