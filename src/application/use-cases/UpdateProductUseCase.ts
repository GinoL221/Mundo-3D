import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import { ProductDTO } from '../dtos/ProductDTO';

export interface UpdateProductInput {
  NameProduct?: string;
  Price?: number;
  DescriptionProduct?: string | null;
  Image?: string | null;
  IDCategory?: number;
  IDFranchise?: number;
}

export class UpdateProductUseCase {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly categoryRepo?: ICategoryRepository
  ) {}

  async execute(id: number, input: UpdateProductInput): Promise<ProductDTO | null> {
    const updated = await this.productRepo.update(id, input);
    if (!updated) {
      return null;
    }

    let categoryName = 'Sin categoría';
    if (updated.Category) {
      categoryName = updated.Category.NameCategory;
    } else if (this.categoryRepo && updated.IDCategory) {
      const category = await this.categoryRepo.findById(updated.IDCategory);
      if (category) {
        categoryName = category.NameCategory;
      }
    }

    return {
      IDProduct: updated.IDProduct,
      NameProduct: updated.NameProduct,
      Price: Number(updated.Price),
      DescriptionProduct: updated.DescriptionProduct,
      Image: updated.Image,
      IDCategory: updated.IDCategory,
      IDFranchise: updated.IDFranchise,
      Category: categoryName,
    };
  }
}
