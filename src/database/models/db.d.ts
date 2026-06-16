import { Model, ModelCtor, Sequelize } from 'sequelize';

export interface ProductAttributes {
  IDProduct: number;
  IDCategory: number;
  IDFranchise: number;
  NameProduct: string;
  Price: number;
  DescriptionProduct: string | null;
  Image: string | null;
}

export interface CategoryAttributes {
  IDCategory: number;
  NameCategory: string;
}

export interface FranchiseAttributes {
  IDFranchise: number;
  NameFranchise: string;
}

export interface ProductInstance extends Model<ProductAttributes, Partial<ProductAttributes>>, ProductAttributes {
  Category?: CategoryInstance;
  Franchise?: FranchiseInstance;
}

export interface CategoryInstance extends Model<CategoryAttributes, Partial<CategoryAttributes>>, CategoryAttributes {}

export interface FranchiseInstance extends Model<FranchiseAttributes, Partial<FranchiseAttributes>>, FranchiseAttributes {}

export const Product: ModelCtor<ProductInstance>;
export const Category: ModelCtor<CategoryInstance>;
export const Franchise: ModelCtor<FranchiseInstance>;
export const sequelize: Sequelize;
