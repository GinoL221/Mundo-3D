import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import { ProductDTO } from '../dtos/ProductDTO';

export interface UpdateProductInput {
  nameProduct?: string;
  price?: number;
  descriptionProduct?: string | null;
  image?: string | null;
  idCategory?: number;
  idFranchise?: number;
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
      categoryName = updated.Category.nameCategory;
    } else if (this.categoryRepo && updated.idCategory) {
      const category = await this.categoryRepo.findById(updated.idCategory);
      if (category) {
        categoryName = category.nameCategory;
      }
    }

    return {
      idProduct: updated.idProduct,
      nameProduct: updated.nameProduct,
      price: Number(updated.price),
      descriptionProduct: updated.descriptionProduct,
      image: updated.image,
      idCategory: updated.idCategory,
      idFranchise: updated.idFranchise,
      Category: categoryName,
    };
  }
}
