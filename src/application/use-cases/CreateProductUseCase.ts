import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import { ProductDTO } from '../dtos/ProductDTO';

export interface CreateProductInput {
  NameProduct: string;
  Price: number;
  DescriptionProduct: string | null;
  Image: string | null;
  IDCategory: number;
  IDFranchise: number;
}

export class CreateProductUseCase {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly categoryRepo?: ICategoryRepository
  ) {}

  async execute(input: CreateProductInput): Promise<ProductDTO> {
    const created = await this.productRepo.create({
      NameProduct: input.NameProduct,
      Price: input.Price,
      DescriptionProduct: input.DescriptionProduct,
      Image: input.Image,
      IDCategory: input.IDCategory,
      IDFranchise: input.IDFranchise,
    });

    let categoryName = 'Sin categoría';
    if (created.Category) {
      categoryName = created.Category.NameCategory;
    } else if (this.categoryRepo) {
      const category = await this.categoryRepo.findById(input.IDCategory);
      if (category) {
        categoryName = category.NameCategory;
      }
    }

    return {
      IDProduct: created.IDProduct,
      NameProduct: created.NameProduct,
      Price: Number(created.Price),
      DescriptionProduct: created.DescriptionProduct,
      Image: created.Image,
      IDCategory: created.IDCategory,
      IDFranchise: created.IDFranchise,
      Category: categoryName,
    };
  }
}
