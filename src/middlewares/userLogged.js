const { initializeModels } = require('../database/models');
const db = initializeModels();
const { User } = db;

const userLoggedMiddleware = async (req, res, next) => {
  res.locals.isLogged = false;

  try {
    if (req.cookies) {
      const emailInCookie = req.cookies.userEmail;
      const userFromCookie = await User.findOne({
        where: { Email: emailInCookie },
        attributes: { exclude: ['PasswordUser'] },
      });

      if (userFromCookie) {
        res.locals.userLogged = userFromCookie;
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
