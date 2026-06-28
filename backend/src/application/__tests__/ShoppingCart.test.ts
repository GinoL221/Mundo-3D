import { CartValidationException } from '../../domain/exceptions/CartValidationException';
import { ShoppingCart, CartStatus } from '../../domain/entities/ShoppingCart';

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

  it('should throw CartValidationException when quantity is greater than 10', () => {
    expect(() => {
      new ShoppingCart(1, 10, 100, 11, 150.00, CartStatus.ACTIVE);
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


