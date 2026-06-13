const { validationResult } = require('express-validator');
const { UserService } = require('../../services');
const crypto = require('crypto');

const processLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render('users/login', {
        errors: errors.mapped(),
        oldData: req.body.email,
      });
    }

    const { email, password, remember } = req.body;

    const userToLogin = await UserService.findByEmail(email, {
      includePassword: true,
    });

    let isCredentialsCorrect = false;
    if (userToLogin && UserService.verifyPassword(password, userToLogin.PasswordUser)) {
      isCredentialsCorrect = true;
    }

    if (!isCredentialsCorrect) {
      return res.render('users/login', {
        errors: {
          email: {
            msg: 'El email o la contraseña no coinciden',
          },
          password: {
            msg: 'El email o la contraseña no coinciden',
          },
        },
        oldData: req.body.email,
      });
    }

    const userWithoutPassword = {
      IDUser: userToLogin.IDUser,
      FirstName: userToLogin.FirstName,
      LastName: userToLogin.LastName,
      Email: userToLogin.Email,
      Image: userToLogin.Image,
    };

    req.session.userLogged = userWithoutPassword;

    if (remember) {
      const plainToken = crypto.randomBytes(32).toString('hex');
      const durationSeconds = 30 * 24 * 60 * 60; // 30 days
      await UserService.createRememberToken(userToLogin.IDUser, plainToken, durationSeconds);

      res.cookie('remember_token', `${userToLogin.IDUser}:${plainToken}`, {
        maxAge: durationSeconds * 1000,
        signed: true,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }

    return res.redirect('profile');
  } catch (error) {
    console.error('Error al procesar el login:', error);
    next(error);
  }
};

module.exports = processLogin;
