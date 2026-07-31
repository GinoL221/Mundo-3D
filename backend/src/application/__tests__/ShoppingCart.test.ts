import { CartValidationException } from '../../domain/exceptions/CartValidationException';
import { ShoppingCart, CartStatus, MAX_CART_ITEM_QUANTITY } from '../../domain/entities/ShoppingCart';

describe('CartValidationException', () => {
  it('should extend Error and set name property correctly', () => {
    const error = new CartValidationException('Invalid quantity');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CartValidationException');
    expect(error.message).toBe('Invalid quantity');
  });
});

describe('ShoppingCart Entity', () => {
  it('should successfully create a valid domain entity with ACTIVE status', () => {
    const cart = new ShoppingCart(1, 10, 100, 2, 150.00, CartStatus.ACTIVE);
    expect(cart.idCart).toBe(1);
    expect(cart.idUser).toBe(10);
    expect(cart.idProduct).toBe(100);
    expect(cart.quantity).toBe(2);
    expect(cart.unitPrice).toBe(150.00);
    expect(cart.status).toBe(CartStatus.ACTIVE);
  });

  it('should throw CartValidationException when quantity is 0', () => {
    expect(() => {
      new ShoppingCart(1, 10, 100, 0, 150.00, CartStatus.ACTIVE);
    }).toThrow(CartValidationException);
  });

  it('should throw CartValidationException when quantity is negative', () => {
    expect(() => {
      new ShoppingCart(1, 10, 100, -5, 150.00, CartStatus.ACTIVE);
    }).toThrow(CartValidationException);
  });

  it('should successfully create a valid domain entity when quantity is at the ceiling boundary of 99', () => {
    const cart = new ShoppingCart(1, 10, 100, 99, 150.00, CartStatus.ACTIVE);
    expect(cart.quantity).toBe(99);
  });

  it('should throw CartValidationException when quantity is greater than 99', () => {
    expect(() => {
      new ShoppingCart(1, 10, 100, 100, 150.00, CartStatus.ACTIVE);
    }).toThrow(CartValidationException);
  });

  it('should throw CartValidationException when quantity is not an integer', () => {
    expect(() => {
      new ShoppingCart(1, 10, 100, 2.5, 150.00, CartStatus.ACTIVE);
    }).toThrow(CartValidationException);
  });

  it('should return true for hasPriceDrift when active product price differs from unitPrice', () => {
    const cart = new ShoppingCart(1, 10, 100, 2, 100.00, CartStatus.ACTIVE);
    expect(cart.hasPriceDrift(120.00)).toBe(true);
    expect(cart.hasPriceDrift(80.00)).toBe(true);
  });

  it('should return false for hasPriceDrift when active product price matches unitPrice', () => {
    const cart = new ShoppingCart(1, 10, 100, 2, 100.00, CartStatus.ACTIVE);
    expect(cart.hasPriceDrift(100.00)).toBe(false);
  });

});

describe('ShoppingCart.assertValidQuantity', () => {
  it('exposes MAX_CART_ITEM_QUANTITY as 99', () => {
    expect(MAX_CART_ITEM_QUANTITY).toBe(99);
  });

  it('does not throw for a valid quantity', () => {
    expect(() => ShoppingCart.assertValidQuantity(99)).not.toThrow();
  });

  it('throws CartValidationException for a non-integer quantity', () => {
    expect(() => ShoppingCart.assertValidQuantity(2.5)).toThrow(CartValidationException);
  });

  it('throws CartValidationException for a quantity <= 0', () => {
    expect(() => ShoppingCart.assertValidQuantity(0)).toThrow(CartValidationException);
  });

  it('throws CartValidationException for a quantity > MAX_CART_ITEM_QUANTITY', () => {
    expect(() => ShoppingCart.assertValidQuantity(100)).toThrow(CartValidationException);
  });
});


