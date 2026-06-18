import { ShoppingCart, CartStatus } from '../../domain/entities/ShoppingCart';
import { Product } from '../../domain/entities/Product';
import { mapToShoppingCartDTO } from '../dtos/ShoppingCartDTO';

describe('mapToShoppingCartDTO', () => {
  it('should correctly map a ShoppingCart entity and its Product to ShoppingCartDTO with PascalCase properties', () => {
    const product = new Product(10, 'Awesome Mug', 20.00, 'A nice mug', 'mug.png', 1, 2);
    const cartItem = new ShoppingCart(1, 5, 10, 2, 18.50, CartStatus.ACTIVE, product);

    const dto = mapToShoppingCartDTO(cartItem);

    expect(dto).toEqual({
      IDCart: 1,
      IDUser: 5,
      IDProduct: 10,
      Quantity: 2,
      UnitPrice: 18.50,
      CartStatus: 'ACTIVE',
      hasPriceDrift: true, // 18.50 !== 20.00
      product: {
        IDProduct: 10,
        NameProduct: 'Awesome Mug',
        Price: 20.00,
        Image: 'mug.png',
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
      IDProduct: 10,
      NameProduct: 'Unknown Product',
      Price: 20.00,
      Image: null,
    });
    expect(dto.hasPriceDrift).toBe(false);
  });
});
