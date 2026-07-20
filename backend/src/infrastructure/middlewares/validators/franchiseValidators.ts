import { body } from 'express-validator';

const nameFranchiseValidator = body('nameFranchise')
  .trim()
  .notEmpty()
  .withMessage('Debe ingresar un nombre de franquicia')
  .bail()
  .isString()
  .withMessage('Tienes que ingresar un nombre de franquicia válido');

export const franchiseCreateValidators = [nameFranchiseValidator];

export const franchiseUpdateValidators = [nameFranchiseValidator];
