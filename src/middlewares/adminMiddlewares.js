// Re-export from split files for backward compatibility
const { isUser, guestMiddleware, authMiddleware } = require('./auth');
const userLoggedMiddleware = require('./userLogged');

module.exports = {
  isUser,
  guestMiddleware,
  authMiddleware,
  userLoggedMiddleware,
};
