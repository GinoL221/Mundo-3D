const { UserService } = require('../services');

const userLoggedMiddleware = async (req, res, next) => {
  res.locals.isLogged = false;

  try {
    if (req.cookies) {
      const emailInCookie = req.cookies.userEmail;
      if (emailInCookie) {
        const userFromCookie = await UserService.findByEmail(emailInCookie);

        if (userFromCookie) {
          res.locals.userLogged = userFromCookie;
        }
      }
    }
  } catch (error) {
    console.error('Error al buscar usuario en la base de datos:', error);
  }

  if (req.session.userLogged) {
    res.locals.isLogged = true;
    res.locals.userLogged = req.session.userLogged;
  }

  next();
};

module.exports = userLoggedMiddleware;
