import { IProductRepository } from '../../domain/ports/IProductRepository';

export class DeleteProductUseCase {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(id: number): Promise<boolean> {
    return this.productRepo.delete(id);
  }
}
