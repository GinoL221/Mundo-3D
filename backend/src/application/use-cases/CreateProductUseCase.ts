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
  material?: string | null;
  height?: number | null;
  width?: number | null;
  depth?: number | null;
  finish?: string | null;
  productionTime?: number | null;
  stock?: number;
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
      material: input.material ?? null,
      height: input.height ?? null,
      width: input.width ?? null,
      depth: input.depth ?? null,
      finish: input.finish ?? null,
      productionTime: input.productionTime ?? null,
      stock: input.stock ?? 0,
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
      category: categoryName,
      material: created.Material,
      height: created.Height,
      width: created.Width,
      depth: created.Depth,
      finish: created.Finish,
      productionTime: created.ProductionTime,
      stock: created.Stock ?? 0,
    };
  }
}
