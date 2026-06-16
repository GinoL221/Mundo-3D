import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ProductDTO } from '../dtos/ProductDTO';

export class GetProductByIdUseCase {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(id: number): Promise<ProductDTO> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }

    const categoryName = product.Category ? product.Category.NameCategory : 'Sin categoría';

    return {
      IDProduct: product.IDProduct,
      NameProduct: product.NameProduct,
      Price: Number(product.Price),
      DescriptionProduct: product.DescriptionProduct,
      Image: product.Image,
      IDCategory: product.IDCategory,
      IDFranchise: product.IDFranchise,
      Category: categoryName,
    };
  }
}
