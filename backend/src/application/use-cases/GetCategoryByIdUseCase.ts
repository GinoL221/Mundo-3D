import { CategoryRepositoryPort } from '../../domain/ports/CategoryRepositoryPort';
import { CategoryDTO } from '../dtos/CategoryDTO';

export class GetCategoryByIdUseCase {
  constructor(private readonly categoryRepo: CategoryRepositoryPort) {}

  async execute(id: number): Promise<CategoryDTO> {
    const category = await this.categoryRepo.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    return {
      idCategory: category.idCategory,
      nameCategory: category.nameCategory,
    };
  }
}
