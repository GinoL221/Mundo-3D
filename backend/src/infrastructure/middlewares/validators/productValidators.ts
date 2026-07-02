import { body } from 'express-validator';
import path from 'path';
import { ALLOWED_MATERIALS, CUSTOM_MATERIAL_PREFIX, MAX_PRODUCTION_TIME_DAYS } from '../../../domain/entities/Product';

// Image is required on create; optional on update (only validated if a file
// was actually uploaded, since PUT allows updating a product without
// replacing its image).
const imageValidator = (required: boolean) =>
  body('image').custom((_value, { req }) => {
    const file = req.file;
    const acceptedExtensions = ['.jpg', '.png'];

    if (!file) {
      if (required) {
        throw new Error('Tienes que subir una imagen');
      }
      return true;
    }

    const fileExtension = path.extname(file.originalname);
    if (!acceptedExtensions.includes(fileExtension)) {
      throw new Error(
        `Las extensiones de archivos permitidas son ${acceptedExtensions.join(', ')}`,
      );
    }
    return true;
  });

// Optional 3D-printing attributes shared by create and update: on update they
// stay `.optional()` so a caller can PATCH-like update a subset of fields via
// PUT; on create they are also optional (not part of the required set).
const optionalProductAttributeValidators = [
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

  // `stock` is accepted here only as an optional, non-negative integer for
  // create (defaulted to 0 by CreateProductUseCase when omitted). PUT
  // /api/products/:id MUST NOT modify stock — UpdateProductUseCase/
  // SequelizeProductRepository.update() ignore this field entirely even if
  // present in the body; stock mutation happens exclusively via
  // PATCH /api/products/:id/stock.
  body('stock')
    .optional({ values: 'falsy' })
    .isInt({ min: 0 })
    .withMessage('El stock debe ser un entero mayor o igual a 0'),
];

export const productCreateValidators = [
  body('nameProduct')
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

  body('descriptionProduct')
    .trim()
    .notEmpty()
    .withMessage('Debe ingresar una descripción')
    .bail()
    .isString()
    .withMessage('Tiene que ser un texto')
    .bail()
    .isLength({ max: 40 })
    .withMessage('No puede ser mayor a 40 caracteres'),

  body('idCategory').notEmpty().withMessage('Debe seleccionar una categoría'),

  body('idFranchise').notEmpty().withMessage('Debe seleccionar una franquicia'),

  imageValidator(true),

  ...optionalProductAttributeValidators,
];

export const productUpdateValidators = [
  body('nameProduct')
    .optional({ values: 'falsy' })
    .trim()
    .isString()
    .withMessage('Tienes que ingresar un nombre válido')
    .bail()
    .isLength({ min: 5, max: 20 })
    .withMessage('Tiene que tener entre 5 y 20 caracteres'),

  body('price')
    .optional({ values: 'falsy' })
    .trim()
    .isNumeric()
    .withMessage('Debe ingresar un número'),

  body('descriptionProduct')
    .optional({ values: 'falsy' })
    .trim()
    .isString()
    .withMessage('Tiene que ser un texto')
    .bail()
    .isLength({ max: 40 })
    .withMessage('No puede ser mayor a 40 caracteres'),

  body('idCategory').optional({ values: 'falsy' }).notEmpty().withMessage('Debe seleccionar una categoría'),

  body('idFranchise').optional({ values: 'falsy' }).notEmpty().withMessage('Debe seleccionar una franquicia'),

  imageValidator(false),

  ...optionalProductAttributeValidators,
];
