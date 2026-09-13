import { body } from 'express-validator';

export const resendEmailConfirmationValidation = [
  body('email').trim().isEmail().withMessage('Invalid email'),
];
