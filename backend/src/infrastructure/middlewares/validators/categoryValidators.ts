import { body } from 'express-validator';

// `nameCategory` is required, trimmed, and non-empty on BOTH create and
// update — unlike Product's optional-on-update validators, Category is a
// single-field entity, so a PUT without its only field is meaningless (see
// design.md decision #4). No length or uniqueness constraints are enforced
// per the category-api spec.
const nameCategoryValidator = body('nameCategory')
  .trim()
  .notEmpty()
  .withMessage('Debe ingresar un nombre de categoría')
  .bail()
  .isString()
  .withMessage('Tienes que ingresar un nombre de categoría válido');

export const categoryCreateValidators = [nameCategoryValidator];

export const categoryUpdateValidators = [nameCategoryValidator];
