import { ShoppingCartRepositoryPort } from '../../domain/ports/ShoppingCartRepositoryPort';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { ShoppingCart } from '../../domain/entities/ShoppingCart';

export class SyncCartUseCase {
  constructor(
    private readonly cartRepo: ShoppingCartRepositoryPort,
    private readonly productRepo: ProductRepositoryPort
  ) {}

  private mergeItems(
    items: { productId: number; quantity: number }[]
  ): Map<number, number> {
    const merged = new Map<number, number>();
    for (const item of items) {
      const currentQuantity = merged.get(item.productId) ?? 0;
      merged.set(item.productId, currentQuantity + item.quantity);
    }
    return merged;
  }

  async execute(
    userId: number,
    items: { productId: number; quantity: number }[]
  ): Promise<void> {
    const mergedItems = this.mergeItems(items);

    for (const quantity of mergedItems.values()) {
      ShoppingCart.assertValidQuantity(quantity);
    }

    const syncItems: { productId: number; quantity: number; unitPrice: number }[] = [];

    for (const [productId, quantity] of mergedItems) {
      const product = await this.productRepo.findById(productId);
      if (product) {
        syncItems.push({
          productId,
          quantity,
          unitPrice: product.price,
        });
      }
    }

    await this.cartRepo.syncCart(userId, syncItems);
  }
}
