const path = require('path');
const { validationResult } = require('express-validator');
const { UserService } = require('../../services');

const postNewUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render(path.join(__dirname, '../../views/users/register.ejs'), {
        errors: errors.mapped(),
        oldData: req.body,
      });
    }

    if (!req.file) {
      throw new Error('Tienes que subir una imagen');
    }

    const { firstName, lastName, email, password } = req.body;
    const image = req.file.filename;

    const userInDB = await UserService.findByEmail(email);
    if (userInDB) {
      return res.render(path.join(__dirname, '../../views/users/register.ejs'), {
        errors: {
          email: { msg: 'Este email ya está registrado' },
        },
        oldData: req.body,
      });
    }

    const newUser = await UserService.create({
      FirstName: firstName,
      LastName: lastName,
      Email: email,
      PasswordUser: password,
      Image: image,
    });

    res.redirect('/users');
  } catch (error) {
    console.error('Error en el controlador postNewUser:', error);
    next(error);
  }
};

module.exports = postNewUser;
