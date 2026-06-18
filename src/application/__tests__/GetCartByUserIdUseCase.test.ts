import { GetCartByUserIdUseCase } from '../use-cases/GetCartByUserIdUseCase';
import { IShoppingCartRepository } from '../../domain/ports/IShoppingCartRepository';
import { ShoppingCart, CartStatus } from '../../domain/entities/ShoppingCart';
import { Product } from '../../domain/entities/Product';

describe('GetCartByUserIdUseCase', () => {
  let repositoryMock: jest.Mocked<IShoppingCartRepository>;
  let useCase: GetCartByUserIdUseCase;

  beforeEach(() => {
    repositoryMock = {
      findByUserId: jest.fn(),
      getDistinctCount: jest.fn(),
    };
    useCase = new GetCartByUserIdUseCase(repositoryMock);
  });

  it('should return empty items and 0 total when cart is empty', async () => {
    repositoryMock.findByUserId.mockResolvedValue([]);

    const result = await useCase.execute(5);

    expect(repositoryMock.findByUserId).toHaveBeenCalledWith(5);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should only return ACTIVE items, map them to DTO, and compute correct total', async () => {
    const productA = new Product(10, 'Product A', 100.0, 'Desc A', 'imgA.png', 1, 2);
    const productB = new Product(20, 'Product B', 50.0, 'Desc B', 'imgB.png', 1, 2);

    const itemA = new ShoppingCart(1, 5, 10, 2, 100.0, CartStatus.ACTIVE, productA); // Active: 2 * 100 = 200
    const itemB = new ShoppingCart(2, 5, 20, 3, 50.0, CartStatus.ACTIVE, productB);  // Active: 3 * 50 = 150
    const itemC = new ShoppingCart(3, 5, 30, 1, 25.0, CartStatus.ORDERED, productB); // Ordered: should be ignored

    repositoryMock.findByUserId.mockResolvedValue([itemA, itemB, itemC]);

    const result = await useCase.execute(5);

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(350.0);
    expect(result.items[0].IDCart).toBe(1);
    expect(result.items[0].product.NameProduct).toBe('Product A');
    expect(result.items[1].IDCart).toBe(2);
    expect(result.items[1].product.NameProduct).toBe('Product B');
  });

  it('should detect price drift in mapped items correctly', async () => {
    const productA = new Product(10, 'Product A', 120.0, 'Desc A', 'imgA.png', 1, 2); // Catalog price 120
    const itemA = new ShoppingCart(1, 5, 10, 2, 100.0, CartStatus.ACTIVE, productA); // Cart unitPrice 100

    repositoryMock.findByUserId.mockResolvedValue([itemA]);

    const result = await useCase.execute(5);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].hasPriceDrift).toBe(true);
    expect(result.total).toBe(200.0); // 2 * 100
  });
});
