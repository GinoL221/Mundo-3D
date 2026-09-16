import { ShoppingCartRepositoryPort } from '../../domain/ports/ShoppingCartRepositoryPort';
import { GetCartResult, mapToShoppingCartDTO } from '../dtos/ShoppingCartDTO';
import { CartStatus } from '../../domain/entities/ShoppingCart';

export class GetCartByUserIdUseCase {
  constructor(private readonly cartRepo: ShoppingCartRepositoryPort) {}

  async execute(userId: number): Promise<GetCartResult> {
    const cartEntities = await this.cartRepo.findByUserId(userId);

    // Filter to only include ACTIVE cart items
    const activeEntities = cartEntities.filter((item) => item.status === CartStatus.ACTIVE);

    // Map to DTOs
    const items = activeEntities.map((item) => mapToShoppingCartDTO(item));

    // Compute total sum: quantity * unitPrice
    const total = activeEntities.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    return {
      items,
      total,
    };
  }
}
