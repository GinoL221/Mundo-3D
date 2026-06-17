const mockDeleteExecute = jest.fn();

jest.mock('../application/use-cases/DeleteRememberTokenUseCase', () => {
  return {
    DeleteRememberTokenUseCase: jest.fn().mockImplementation(() => {
      return {
        execute: mockDeleteExecute,
      };
    }),
  };
});

const logout = require('../controllers/users/logout');

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
    mockDeleteExecute.mockResolvedValue(true);

    // The logout controller calls session.destroy with a callback that calls res.redirect.
    // We need to wait for the full execution.
    await logout(req, res);

    expect(mockDeleteExecute).toHaveBeenCalledWith('plain_token_xyz');
    expect(res.clearCookie).toHaveBeenCalledWith('remember_token');
    expect(req.session.destroy).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('clears remember_token cookie and does not call DB delete if no remember_token cookie exists', async () => {
    await logout(req, res);

    expect(mockDeleteExecute).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith('remember_token');
    expect(req.session.destroy).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });
});
