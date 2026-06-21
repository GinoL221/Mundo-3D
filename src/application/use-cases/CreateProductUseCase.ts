import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import { ProductDTO } from '../dtos/ProductDTO';

export interface CreateProductInput {
  nameProduct: string;
  price: number;
  descriptionProduct: string | null;
  image: string | null;
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
      nameProduct: input.nameProduct,
      price: input.price,
      descriptionProduct: input.descriptionProduct,
      image: input.image,
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
      idProduct: created.idProduct,
      nameProduct: created.nameProduct,
      price: Number(created.price),
      descriptionProduct: created.descriptionProduct,
      image: created.image,
      idCategory: created.idCategory,
      idFranchise: created.idFranchise,
      Category: categoryName,
    };
  }
}
