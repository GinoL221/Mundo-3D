import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import { ProductDTO } from '../dtos/ProductDTO';

export interface CreateProductInput {
  NameProduct: string;
  Price: number;
  DescriptionProduct: string | null;
  Image: string | null;
  idCategory: number;
  idFranchise: number;
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
      idCategory: input.idCategory,
      idFranchise: input.idFranchise,
    });

    let categoryName = 'Sin categoría';
    if (created.Category) {
      categoryName = created.Category.nameCategory;
    } else if (this.categoryRepo) {
      const category = await this.categoryRepo.findById(input.idCategory);
      if (category) {
        categoryName = category.nameCategory;
      }
    }

    return {
      IDProduct: created.IDProduct,
      NameProduct: created.NameProduct,
      Price: Number(created.Price),
      DescriptionProduct: created.DescriptionProduct,
      Image: created.Image,
      idCategory: created.idCategory,
      idFranchise: created.idFranchise,
      Category: categoryName,
    };
  }
}
