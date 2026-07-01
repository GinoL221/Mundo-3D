import { body } from 'express-validator';
import path from 'path';
import { ALLOWED_MATERIALS, CUSTOM_MATERIAL_PREFIX, MAX_PRODUCTION_TIME_DAYS } from '../../../domain/entities/Product';

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

  body('material')
    .optional({ values: 'falsy' })
    .trim()
    .custom((value) => {
      if (ALLOWED_MATERIALS.includes(value) || value.startsWith(CUSTOM_MATERIAL_PREFIX)) {
        return true;
      }
      throw new Error('Material inválido');
    }),

  body('height')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 })
    .withMessage('La altura debe ser un número mayor o igual a 0'),

  body('width')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 })
    .withMessage('El ancho debe ser un número mayor o igual a 0'),

  body('depth')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 })
    .withMessage('La profundidad debe ser un número mayor o igual a 0'),

  body('finish')
    .optional({ values: 'falsy' })
    .trim()
    .isString()
    .withMessage('El acabado debe ser un texto'),

  body('productionTime')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: MAX_PRODUCTION_TIME_DAYS })
    .withMessage(`El tiempo de producción debe ser un entero entre 1 y ${MAX_PRODUCTION_TIME_DAYS} días`),
];
