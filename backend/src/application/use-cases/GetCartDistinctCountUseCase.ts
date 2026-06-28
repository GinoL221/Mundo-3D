import { IShoppingCartRepository } from '../../domain/ports/IShoppingCartRepository';

export class GetCartDistinctCountUseCase {
  constructor(private readonly cartRepo: IShoppingCartRepository) {}

  async execute(userId: number): Promise<number> {
    return this.cartRepo.getDistinctCount(userId);
  }
}
