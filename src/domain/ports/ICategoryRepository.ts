import { Category } from '../entities/Category';

export interface ICategoryRepository {
  findAll(): Promise<Category[]>;
  findById(id: number): Promise<Category | null>;
  create(category: Omit<Category, 'idCategory'>): Promise<Category>;
  update(id: number, category: Partial<Category>): Promise<Category | null>;
  delete(id: number): Promise<boolean>;
}
