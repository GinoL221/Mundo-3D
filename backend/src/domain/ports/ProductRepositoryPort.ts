import { Product } from '../entities/Product';
import { TransactionContext } from './UnitOfWorkPort';

// product-catalog-search: options for the public paginated search/filter
// endpoint. `search` is already trimmed by the use case; `undefined` means
// blank/whitespace-only (treated as absent). Independent of `findAll()`,
// which stays untouched for the existing unpaginated admin listing.
export interface ProductSearchOptions {
  search?: string;
  idCategory?: number;
  idFranchise?: number;
  limit: number;
  offset: number;
}

export interface PagedProducts {
  products: Product[];
  total: number;
}

export interface ProductRepositoryPort {
  findAll(): Promise<Product[]>;
  findById(id: number): Promise<Product | null>;
  findLatest(): Promise<Product | null>;
  create(product: Omit<Product, 'idProduct' | 'IDProduct' | 'NameProduct' | 'Price' | 'DescriptionProduct' | 'Image' | 'IDCategory' | 'IDFranchise' | 'Category' | 'Franchise' | 'Material' | 'Height' | 'Width' | 'Depth' | 'Finish' | 'ProductionTime' | 'Stock'>): Promise<Product>;
  // `stock` is intentionally excluded — PUT /api/products/:id MUST NOT modify stock
  // (product-inventory spec, "Product Update"). Stock is mutated exclusively via
  // `adjustStock` below.
  update(id: number, product: Omit<Partial<Product>, 'stock'>): Promise<Product | null>;
  delete(id: number): Promise<boolean>;
  adjustStock(id: number, delta: number, tx?: TransactionContext): Promise<Product | null>;
  searchPaged(options: ProductSearchOptions): Promise<PagedProducts>;
}
