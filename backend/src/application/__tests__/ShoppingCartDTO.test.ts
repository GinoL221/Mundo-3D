import { ShoppingCart, CartStatus } from '../../domain/entities/ShoppingCart';
import { Product } from '../../domain/entities/Product';
import { mapToShoppingCartDTO } from '../dtos/ShoppingCartDTO';

describe('mapToShoppingCartDTO', () => {
  it('should correctly map a ShoppingCart entity and its Product to ShoppingCartDTO with camelCase properties', () => {
    const product = new Product(10, 'Awesome Mug', 20.00, 'A nice mug', 'mug.png', 1, 2);
    const cartItem = new ShoppingCart(1, 5, 10, 2, 18.50, CartStatus.ACTIVE, product);

    const dto = mapToShoppingCartDTO(cartItem);

    expect(dto).toEqual({
      idCart: 1,
      idUser: 5,
      idProduct: 10,
      quantity: 2,
      unitPrice: 18.50,
      status: 'ACTIVE',
      hasPriceDrift: true, // 18.50 !== 20.00
      product: {
        idProduct: 10,
        nameProduct: 'Awesome Mug',
        price: 20.00,
        image: 'mug.png',
      },
    });
  });

  it('should calculate hasPriceDrift as false when prices match', () => {
    const product = new Product(10, 'Awesome Mug', 20.00, 'A nice mug', 'mug.png', 1, 2);
    const cartItem = new ShoppingCart(1, 5, 10, 2, 20.00, CartStatus.ACTIVE, product);

    const dto = mapToShoppingCartDTO(cartItem);

    expect(dto.hasPriceDrift).toBe(false);
  });

  it('should handle missing product gracefully by setting default product values and hasPriceDrift false', () => {
    const cartItem = new ShoppingCart(1, 5, 10, 2, 20.00, CartStatus.ACTIVE);

    const dto = mapToShoppingCartDTO(cartItem);

    expect(dto.product).toEqual({
      idProduct: 10,
      nameProduct: 'Unknown Product',
      price: 20.00,
      image: null,
    });
    expect(dto.hasPriceDrift).toBe(false);
  });
});
