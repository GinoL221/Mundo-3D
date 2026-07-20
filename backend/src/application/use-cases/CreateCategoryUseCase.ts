import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import { CategoryDTO } from '../dtos/CategoryDTO';

export interface CreateCategoryInput {
  nameCategory: string;
}

export class CreateCategoryUseCase {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  async execute(input: CreateCategoryInput): Promise<CategoryDTO> {
    const created = await this.categoryRepo.create({
      nameCategory: input.nameCategory,
    });

    return {
      idCategory: created.idCategory,
      nameCategory: created.nameCategory,
    };
  }
}
