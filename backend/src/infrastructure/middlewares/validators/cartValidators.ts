import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { CartValidationException } from '../../../domain/exceptions/CartValidationException';

export const validationsCart = [
  // `items` may be an empty array: PUT /api/cart performs a full-replace sync
  // (see SyncCartUseCase / SequelizeShoppingCartRepository.syncCart), and an
  // empty array is the valid way to represent an emptied cart (e.g. after
  // checkout). Rejecting it here breaks that flow.
  body('items')
    .isArray()
    .withMessage('Items must be an array'),
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
