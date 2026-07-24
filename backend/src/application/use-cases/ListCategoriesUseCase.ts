import { CategoryRepositoryPort } from '../../domain/ports/CategoryRepositoryPort';
import { CategoryDTO } from '../dtos/CategoryDTO';

export class ListCategoriesUseCase {
  constructor(private readonly categoryRepo: CategoryRepositoryPort) {}

  async execute(): Promise<CategoryDTO[]> {
    const categories = await this.categoryRepo.findAll();
    return categories.map((category) => ({
      idCategory: category.idCategory,
      nameCategory: category.nameCategory,
    }));
  }
}
