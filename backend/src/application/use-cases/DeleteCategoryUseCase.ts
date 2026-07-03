import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';

export class DeleteCategoryUseCase {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  async execute(id: number): Promise<boolean> {
    return this.categoryRepo.delete(id);
  }
}
