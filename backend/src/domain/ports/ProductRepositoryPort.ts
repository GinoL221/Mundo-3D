import { Product } from '../entities/Product';

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
  adjustStock(id: number, delta: number): Promise<Product | null>;
}
