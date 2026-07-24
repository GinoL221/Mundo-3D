import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { CategoryRepositoryPort } from '../../domain/ports/CategoryRepositoryPort';
import { ProductDTO } from '../dtos/ProductDTO';

export interface UpdateProductInput {
  nameProduct?: string;
  price?: number;
  descriptionProduct?: string | null;
  image?: string | null;
  idCategory?: number;
  idFranchise?: number;
  material?: string | null;
  height?: number | null;
  width?: number | null;
  depth?: number | null;
  finish?: string | null;
  productionTime?: number | null;
}

export class UpdateProductUseCase {
  constructor(
    private readonly productRepo: ProductRepositoryPort,
    private readonly categoryRepo?: CategoryRepositoryPort
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
      category: categoryName,
      material: updated.Material,
      height: updated.Height,
      width: updated.Width,
      depth: updated.Depth,
      finish: updated.Finish,
      productionTime: updated.ProductionTime,
      stock: updated.Stock ?? 0,
    };
  }
}
