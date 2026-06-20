import { IShoppingCartRepository } from '../../domain/ports/IShoppingCartRepository';
import { IProductRepository } from '../../domain/ports/IProductRepository';

export class SyncCartUseCase {
  constructor(
    private readonly cartRepo: IShoppingCartRepository,
    private readonly productRepo: IProductRepository
  ) {}

  async execute(
    userId: number,
    items: { productId: number; quantity: number }[]
  ): Promise<void> {
    const syncItems: { productId: number; quantity: number; unitPrice: number }[] = [];

    for (const item of items) {
      const product = await this.productRepo.findById(item.productId);
      if (product) {
        syncItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.Price,
        });
      }
    }

    await this.cartRepo.syncCart(userId, syncItems);
  }
}
