import { Product } from '../entities/Product';

export interface IProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: number): Promise<Product | null>;
  findLatest(): Promise<Product | null>;
  create(product: Omit<Product, 'idProduct' | 'IDProduct' | 'NameProduct' | 'Price' | 'DescriptionProduct' | 'Image' | 'IDCategory' | 'IDFranchise' | 'Category' | 'Franchise' | 'Material' | 'Height' | 'Width' | 'Depth' | 'Finish' | 'ProductionTime' | 'Stock'>): Promise<Product>;
  update(id: number, product: Partial<Product>): Promise<Product | null>;
  delete(id: number): Promise<boolean>;
  adjustStock(id: number, delta: number): Promise<Product | null>;
}
