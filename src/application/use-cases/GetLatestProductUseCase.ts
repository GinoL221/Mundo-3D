import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ProductDTO } from '../dtos/ProductDTO';

export class GetLatestProductUseCase {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(): Promise<ProductDTO> {
    const product = await this.productRepo.findLatest();
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
