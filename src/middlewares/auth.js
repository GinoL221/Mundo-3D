const isUser = (req, res, next) => {
  res.locals.isLogged ? next() : res.redirect('/login');
};

const guestMiddleware = (req, res, next) => {
  if (req.session.userLogged) {
    return res.redirect('/profile');
  }
  next();
};

const authMiddleware = (req, res, next) => {
  if (!req.session.userLogged) {
    return res.redirect('/login');
  }
  next();
};

module.exports = {
  isUser,
  guestMiddleware,
  authMiddleware,
};
