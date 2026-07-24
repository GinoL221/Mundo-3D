import { SyncCartUseCase } from '../use-cases/SyncCartUseCase';
import { ShoppingCartRepositoryPort } from '../../domain/ports/ShoppingCartRepositoryPort';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { Product } from '../../domain/entities/Product';

describe('SyncCartUseCase', () => {
  let cartRepoMock: jest.Mocked<ShoppingCartRepositoryPort>;
  let productRepoMock: jest.Mocked<ProductRepositoryPort>;
  let useCase: SyncCartUseCase;

  beforeEach(() => {
    cartRepoMock = {
      findByUserId: jest.fn(),
      getDistinctCount: jest.fn(),
      syncCart: jest.fn(),
    } as unknown as jest.Mocked<ShoppingCartRepositoryPort>;

    productRepoMock = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findLatest: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      adjustStock: jest.fn(),
    };

    useCase = new SyncCartUseCase(cartRepoMock, productRepoMock);
  });

  it('should sync items successfully by looking up prices in product repository', async () => {
    const productA = new Product(10, 'Product A', 100.0, 'Desc A', 'imgA.png', 1, 2);
    const productB = new Product(20, 'Product B', 50.0, 'Desc B', 'imgB.png', 1, 2);

    productRepoMock.findById.mockImplementation(async (id: number) => {
      if (id === 10) return productA;
      if (id === 20) return productB;
      return null;
    });

    const items = [
      { productId: 10, quantity: 2 },
      { productId: 20, quantity: 3 },
    ];

    await useCase.execute(5, items);

    expect(productRepoMock.findById).toHaveBeenCalledWith(10);
    expect(productRepoMock.findById).toHaveBeenCalledWith(20);

    expect(cartRepoMock.syncCart).toHaveBeenCalledWith(5, [
      { productId: 10, quantity: 2, unitPrice: 100.0 },
      { productId: 20, quantity: 3, unitPrice: 50.0 },
    ]);
  });

  it('should skip product and not call sync if product is not found in catalog', async () => {
    productRepoMock.findById.mockResolvedValue(null);

    const items = [{ productId: 999, quantity: 1 }];

    await useCase.execute(5, items);

    expect(productRepoMock.findById).toHaveBeenCalledWith(999);
    expect(cartRepoMock.syncCart).toHaveBeenCalledWith(5, []);
  });
});
