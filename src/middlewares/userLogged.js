const { UserService } = require('../services');

const userLoggedMiddleware = async (req, res, next) => {
  res.locals.isLogged = false;

  try {
    if (!req.session.userLogged) {
      if (req.signedCookies && req.signedCookies.remember_token) {
        const cookieValue = req.signedCookies.remember_token;
        const parts = cookieValue.split(':');
        if (parts.length === 2) {
          const [userIdStr, plainToken] = parts;
          const userId = parseInt(userIdStr, 10);

          const user = await UserService.verifyRememberToken(plainToken);
          if (user && user.IDUser === userId) {
            req.session.userLogged = user;
          } else {
            res.clearCookie('remember_token');
          }
        } else {
          res.clearCookie('remember_token');
        }
      } else if (req.cookies && req.cookies.remember_token) {
        res.clearCookie('remember_token');
      }
    }
  } catch (error) {
    console.error('Error al verificar remember_token:', error);
  }

  if (req.session.userLogged) {
    res.locals.isLogged = true;
    res.locals.userLogged = req.session.userLogged;
  }

  next();
};

module.exports = userLoggedMiddleware;
