import { CategoryRepositoryPort } from '../../domain/ports/CategoryRepositoryPort';
import { CategoryDTO } from '../dtos/CategoryDTO';

export interface UpdateCategoryInput {
  nameCategory?: string;
}

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepo: CategoryRepositoryPort) {}

  async execute(id: number, input: UpdateCategoryInput): Promise<CategoryDTO | null> {
    const updated = await this.categoryRepo.update(id, input);
    if (!updated) {
      return null;
    }

    return {
      idCategory: updated.idCategory,
      nameCategory: updated.nameCategory,
    };
  }
}
