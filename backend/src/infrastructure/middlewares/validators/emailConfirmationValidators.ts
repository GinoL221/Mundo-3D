import { body } from 'express-validator';

export const resendEmailConfirmationValidation = [
  body('email').trim().isEmail().withMessage('Ingresá un correo válido'),
];
