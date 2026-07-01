import { Request } from 'express';
import { validationResult } from 'express-validator';
import { validationsCart } from '../../validators/cartValidators';
import { CartValidationException } from '../../../../domain/exceptions/CartValidationException';

async function runValidation(req: Request, validations: any[]) {
  (req as any)._validationErrors = undefined;
  for (const validation of validations) {
    await validation.run(req);
  }
  return validationResult(req);
}

describe('cartValidators - cartSyncValidation', () => {
  let req: any;

  beforeEach(() => {
    req = {
      body: {}
    };
  });

  it('fails if items is missing or not an array', async () => {
    req.body = {};
    const errors = await runValidation(req as Request, validationsCart);
    expect(errors.isEmpty()).toBe(false);

    req.body = { items: 'not-an-array' };
    const errors2 = await runValidation(req as Request, validationsCart);
    expect(errors2.isEmpty()).toBe(false);
  });

  it('passes if items is empty (full-replace sync can clear the cart)', async () => {
    req.body = { items: [] };
    const errors = await runValidation(req as Request, validationsCart);
    expect(errors.isEmpty()).toBe(true);
  });

  it('fails if productId is missing or not an integer', async () => {
    req.body = {
      items: [
        { quantity: 5 }
      ]
    };
    const errors = await runValidation(req as Request, validationsCart);
    expect(errors.isEmpty()).toBe(false);

    req.body = {
      items: [
        { productId: 'not-an-int', quantity: 5 }
      ]
    };
    const errors2 = await runValidation(req as Request, validationsCart);
    expect(errors2.isEmpty()).toBe(false);
  });

  it('fails if payload contains legacy idProduct instead of productId', async () => {
    req.body = {
      items: [
        { idProduct: 12, quantity: 2 }
      ]
    };
    const errors = await runValidation(req as Request, validationsCart);
    expect(errors.isEmpty()).toBe(false);
  });

  it('fails if quantity is missing, not an integer, or outside 1-99 range', async () => {
    // Missing quantity
    req.body = {
      items: [
        { productId: 1 }
      ]
    };
    let errors = await runValidation(req as Request, validationsCart);
    expect(errors.isEmpty()).toBe(false);

    // Quantity 0
    req.body = {
      items: [
        { productId: 1, quantity: 0 }
      ]
    };
    errors = await runValidation(req as Request, validationsCart);
    expect(errors.isEmpty()).toBe(false);

    // Quantity 100
    req.body = {
      items: [
        { productId: 1, quantity: 100 }
      ]
    };
    errors = await runValidation(req as Request, validationsCart);
    expect(errors.isEmpty()).toBe(false);

    // Quantity negative
    req.body = {
      items: [
        { productId: 1, quantity: -5 }
      ]
    };
    errors = await runValidation(req as Request, validationsCart);
    expect(errors.isEmpty()).toBe(false);

    // Quantity float
    req.body = {
      items: [
        { productId: 1, quantity: 5.5 }
      ]
    };
    errors = await runValidation(req as Request, validationsCart);
    expect(errors.isEmpty()).toBe(false);
  });

  it('passes on valid cart items', async () => {
    req.body = {
      items: [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 99 }
      ]
    };
    const errors = await runValidation(req as Request, validationsCart);
    expect(errors.isEmpty()).toBe(true);
  });
});
