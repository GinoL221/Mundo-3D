const { UserService } = require('../../services');

const logout = async (req, res) => {
  try {
    if (req.signedCookies && req.signedCookies.remember_token) {
      const cookieValue = req.signedCookies.remember_token;
      const parts = cookieValue.split(':');
      if (parts.length === 2) {
        const plainToken = parts[1];
        await UserService.deleteRememberToken(plainToken);
      }
    }
  } catch (error) {
    console.error('Error deleting remember token on logout:', error);
  }

  res.clearCookie('remember_token');

  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.redirect('/');
      } else {
        return res.redirect('/');
      }
    });
  } else {
    return res.redirect('/');
  }
};

module.exports = logout;
