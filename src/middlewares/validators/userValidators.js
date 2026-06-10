const { body } = require('express-validator');

const validationsUsers = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Tienes que ingresar un nombre')
    .bail()
    .isLength({ min: 2, max: 10 })
    .withMessage('Tiene que tener entre 2 y 10 caracteres'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Tienes que ingresar un apellido')
    .bail()
    .isLength({ min: 2, max: 10 })
    .withMessage('Tiene que tener entre 2 y 10 caracteres'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Tienes que ingresar un mail')
    .bail()
    .isEmail()
    .withMessage('Tienes que ingresar un mail valido'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Tienes que ingresar una contraseña')
    .bail()
    .isLength({ min: 6, max: 16 })
    .withMessage('Tiene que tener entre 6 y 16 caracteres'),
  body('image').custom((value, { req }) => {
    const file = req.file;
    const acceptedExtensions = ['.jpg', '.png'];
    if (!file) {
      throw new Error('Tienes que subir una imagen');
    }
    const fileExtension = require('path').extname(file.originalname);
    if (!acceptedExtensions.includes(fileExtension)) {
      throw new Error(
        `Las extensiones de archivos permitidas son ${acceptedExtensions.join(', ')}`,
      );
    }
    return true;
  }),
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Tienes que ingresar un mail válido'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Tienes que ingresar una contraseña')
    .bail()
    .isLength({ min: 6 })
    .withMessage('Tiene que tener al menos 6 caracteres'),
];

module.exports = { validationsUsers, loginValidation };
