import { body } from 'express-validator';
import path from 'path';

export const validationsForm = [
  body('productName')
    .trim()
    .notEmpty()
    .withMessage('Debe ingresar un nombre')
    .bail()
    .isString()
    .withMessage('Tienes que ingresar un nombre válido')
    .bail()
    .isLength({ min: 5, max: 20 })
    .withMessage('Tiene que tener entre 5 y 20 caracteres'),

  body('price')
    .trim()
    .notEmpty()
    .withMessage('El precio no puede estar vacío')
    .bail()
    .isNumeric()
    .withMessage('Debe ingresar un número'),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Debe ingresar una descripción')
    .bail()
    .isString()
    .withMessage('Tiene que ser un texto')
    .bail()
    .isLength({ max: 40 })
    .withMessage('No puede ser mayor a 40 caracteres'),

  body('category').notEmpty().withMessage('Debe seleccionar una categoría'),

  body('franchise').notEmpty().withMessage('Debe seleccionar una franquicia'),

  body('image').custom((value, { req }) => {
    const file = req.file;
    const acceptedExtensions = ['.jpg', '.png'];
    if (!file) {
      throw new Error('Tienes que subir una imagen');
    }
    const fileExtension = path.extname(file.originalname);
    if (!acceptedExtensions.includes(fileExtension)) {
      throw new Error(
        `Las extensiones de archivos permitidas son ${acceptedExtensions.join(', ')}`,
      );
    }
    return true;
  }),
];
