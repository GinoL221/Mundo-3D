import { IProductRepository } from '../../domain/ports/IProductRepository';
import { ProductDTO } from '../dtos/ProductDTO';

export interface CategoryCountInfo {
  count: number;
  category: {
    idCategory: number;
  } | null;
}

export interface ListProductsResponse {
  count: number;
  products: ProductDTO[];
  countByCategory: Record<string, CategoryCountInfo>;
}

export class ListProductsUseCase {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(): Promise<ListProductsResponse> {
    const products = await this.productRepo.findAll();
    const countByCategory: Record<string, CategoryCountInfo> = {};

    const mapped = products.map((p) => {
      const categoryName = p.Category ? p.Category.nameCategory : 'Sin categoría';

      const categoryInfo = p.Category
        ? {
            idCategory: p.Category.idCategory,
          }
        : null;

      if (!countByCategory[categoryName]) {
        countByCategory[categoryName] = {
          count: 1,
          category: categoryInfo,
        };
      } else {
        countByCategory[categoryName].count++;
      }

      return {
        IDProduct: p.IDProduct,
        NameProduct: p.NameProduct,
        Price: Number(p.Price),
        DescriptionProduct: p.DescriptionProduct,
        Image: p.Image,
        idCategory: p.idCategory,
        idFranchise: p.idFranchise,
        Category: categoryName,
      };
    });

    return {
      count: products.length,
      products: mapped,
      countByCategory,
    };
  }
}
