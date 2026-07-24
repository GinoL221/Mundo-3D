import { CategoryRepositoryPort } from '../../domain/ports/CategoryRepositoryPort';

export class DeleteCategoryUseCase {
  constructor(private readonly categoryRepo: CategoryRepositoryPort) {}

  async execute(id: number): Promise<boolean> {
    return this.categoryRepo.delete(id);
  }
}
