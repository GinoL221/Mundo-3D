import { body } from 'express-validator';
import path from 'path';

export const validationsUsers = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Ingresá tu nombre')
    .bail()
    .isLength({ min: 2, max: 10 })
    .withMessage('Tiene que tener entre 2 y 10 caracteres'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Ingresá tu apellido')
    .bail()
    .isLength({ min: 2, max: 10 })
    .withMessage('Tiene que tener entre 2 y 10 caracteres'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Ingresá tu correo')
    .bail()
    .isEmail()
    .withMessage('Ingresá un correo válido'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Ingresá tu contraseña')
    .bail()
    .isLength({ min: 8, max: 32 })
    .withMessage('Tiene que tener entre 8 y 32 caracteres')
    .bail()
    .matches(/[A-Z]/)
    .withMessage('Tiene que contener al menos una mayúscula')
    .bail()
    .matches(/[0-9]/)
    .withMessage('Tiene que contener al menos un número')
    .bail()
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Tiene que contener al menos un carácter especial'),
  body('confirmPassword')
    .trim()
    .notEmpty()
    .withMessage('Confirmá tu contraseña')
    .bail()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),
  body('image').custom((_value, { req }) => {
    const file = req.file;
    if (!file) {
      return true;
    }
    const acceptedExtensions = ['.jpg', '.png'];
    const fileExtension = path.extname(file.originalname);
    if (!acceptedExtensions.includes(fileExtension)) {
      throw new Error(
        `Las extensiones de archivos permitidas son ${acceptedExtensions.join(', ')}`,
      );
    }
    return true;
  }),
];

export const loginValidation = [
  body('email').trim().isEmail().withMessage('Ingresá un correo válido'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Ingresá tu contraseña')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Tiene que tener al menos 8 caracteres'),
];
