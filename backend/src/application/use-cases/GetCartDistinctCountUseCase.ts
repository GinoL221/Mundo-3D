import { ShoppingCartRepositoryPort } from '../../domain/ports/ShoppingCartRepositoryPort';

export class GetCartDistinctCountUseCase {
  constructor(private readonly cartRepo: ShoppingCartRepositoryPort) {}

  async execute(userId: number): Promise<number> {
    return this.cartRepo.getDistinctCount(userId);
  }
}
