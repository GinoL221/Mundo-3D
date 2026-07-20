import { body } from 'express-validator';

const nameFranchiseValidator = body('nameFranchise')
  .isString()
  .withMessage('Tienes que ingresar un nombre de franquicia válido')
  .bail()
  .trim()
  .notEmpty()
  .withMessage('Debe ingresar un nombre de franquicia')
  .bail();

export const franchiseCreateValidators = [nameFranchiseValidator];

export const franchiseUpdateValidators = [nameFranchiseValidator];
