import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';

export class DeleteProductUseCase {
  constructor(private readonly productRepo: ProductRepositoryPort) {}

  async execute(id: number): Promise<boolean> {
    return this.productRepo.delete(id);
  }
}
