import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { CartValidationException } from '../../../domain/exceptions/CartValidationException';

export const validationsCart = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items must be a non-empty array'),
  body('items.*.productId')
    .isInt({ min: 1 })
    .withMessage('productId must be an integer >= 1'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 99 })
    .withMessage('quantity must be an integer between 1 and 99')
];

export const cartSyncValidation = [
  ...validationsCart,
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new CartValidationException('Invalid cart items');
    }
    next();
  }
];
