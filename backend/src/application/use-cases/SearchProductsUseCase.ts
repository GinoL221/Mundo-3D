import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import { Product } from '../../domain/entities/Product';
import { ProductDTO } from '../dtos/ProductDTO';

// product-catalog-search: constants owned exclusively by this endpoint,
// deliberately independent of any other endpoint's pagination constants
// (design.md decision #4 / proposal decision #4).
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface ProductSearchPageDTO {
  products: ProductDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SearchProductsInput {
  search?: string;
  idCategory?: number;
  idFranchise?: number;
  page: number;
  pageSize: number;
}

// Same field set `ListProductsUseCase.execute` builds inline — kept as its
// own private module function so `ListProductsUseCase.ts` stays byte-for-byte
// unchanged (product-catalog-search success criterion 4).
function mapToProductDTO(p: Product): ProductDTO {
  return {
    idProduct: p.idProduct,
    nameProduct: p.nameProduct,
    price: Number(p.price),
    descriptionProduct: p.descriptionProduct,
    image: p.image,
    idCategory: p.idCategory,
    idFranchise: p.idFranchise,
    category: p.Category ? p.Category.nameCategory : 'Sin categoría',
    material: p.Material,
    height: p.Height,
    width: p.Width,
    depth: p.Depth,
    finish: p.Finish,
    productionTime: p.ProductionTime,
    stock: p.Stock ?? 0,
  };
}

export class SearchProductsUseCase {
  constructor(private readonly productRepo: ProductRepositoryPort) {}

  // `page`/`pageSize` are trusted as already validated by the HTTP layer
  // (`searchProductsValidation`) — no defensive clamping here, mirroring
  // `ListMyOrdersUseCase.execute`.
  async execute(input: SearchProductsInput): Promise<ProductSearchPageDTO> {
    const trimmed = input.search?.trim();
    const offset = (input.page - 1) * input.pageSize;

    const { products, total } = await this.productRepo.searchPaged({
      search: trimmed ? trimmed : undefined,
      idCategory: input.idCategory,
      idFranchise: input.idFranchise,
      limit: input.pageSize,
      offset,
    });

    return {
      products: products.map(mapToProductDTO),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
    };
  }
}
