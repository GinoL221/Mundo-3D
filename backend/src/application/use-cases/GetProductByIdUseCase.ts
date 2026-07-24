import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { ProductDTO } from '../dtos/ProductDTO';

export class GetProductByIdUseCase {
  constructor(private readonly productRepo: ProductRepositoryPort) {}

  async execute(id: number): Promise<ProductDTO> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }

    const categoryName = product.Category ? product.Category.nameCategory : 'Sin categoría';

    return {
      idProduct: product.idProduct,
      nameProduct: product.nameProduct,
      price: Number(product.price),
      descriptionProduct: product.descriptionProduct,
      image: product.image,
      idCategory: product.idCategory,
      idFranchise: product.idFranchise,
      category: categoryName,
      material: product.Material,
      height: product.Height,
      width: product.Width,
      depth: product.Depth,
      finish: product.Finish,
      productionTime: product.ProductionTime,
      stock: product.Stock ?? 0,
    };
  }
}
