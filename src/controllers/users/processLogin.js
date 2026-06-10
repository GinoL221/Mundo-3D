const { validationResult } = require('express-validator');
const { UserService } = require('../../services');

const processLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      const { email, password, remember } = req.body;

      const userToLogin = await UserService.findByEmail(email, {
        includePassword: true,
      });

      if (userToLogin) {
        if (UserService.verifyPassword(password, userToLogin.PasswordUser)) {
          const userWithoutPassword = {
            IDUser: userToLogin.IDUser,
            FirstName: userToLogin.FirstName,
            LastName: userToLogin.LastName,
            Email: userToLogin.Email,
            Image: userToLogin.Image,
          };

          req.session.userLogged = userWithoutPassword;

          if (remember) {
            res.cookie('userEmail', email, { maxAge: 1000 * 60 * 30 });
          }

          return res.redirect('profile');
        } else {
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
      } else {
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
    } else {
      return res.render('users/login', {
        errors: errors.mapped(),
        oldData: req.body.email,
      });
    }
  } catch (error) {
    console.error('Error al procesar el login:', error);
    next(error);
  }
};

module.exports = processLogin;
