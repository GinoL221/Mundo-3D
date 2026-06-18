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

export interface UserAttributes {
  IDUser: number;
  FirstName: string;
  LastName: string;
  Email: string;
  Image: string | null;
  PasswordUser: string;
  IDRole?: number;
  Category?: string;
}

export interface RememberTokenAttributes {
  id: number;
  IDUser: number;
  TokenHash: string;
  ExpiresAt: Date;
}

export interface ShoppingCartAttributes {
  IDCart: number;
  IDUser: number;
  IDProduct: number;
  Quantity: number;
  UnitPrice: number;
  CartStatus: string;
}

export interface ProductInstance extends Model<ProductAttributes, Partial<ProductAttributes>>, ProductAttributes {
  Category?: CategoryInstance;
  Franchise?: FranchiseInstance;
}

export interface CategoryInstance extends Model<CategoryAttributes, Partial<CategoryAttributes>>, CategoryAttributes {}

export interface FranchiseInstance extends Model<FranchiseAttributes, Partial<FranchiseAttributes>>, FranchiseAttributes {}

export interface UserInstance extends Model<UserAttributes, Partial<UserAttributes>>, UserAttributes {
  RememberTokens?: RememberTokenInstance[];
}

export interface RememberTokenInstance extends Model<RememberTokenAttributes, Partial<RememberTokenAttributes>>, RememberTokenAttributes {
  User?: UserInstance;
}

export interface ShoppingCartInstance extends Model<ShoppingCartAttributes, Partial<ShoppingCartAttributes>>, ShoppingCartAttributes {
  product?: ProductInstance;
  User?: UserInstance;
}

export const Product: ModelCtor<ProductInstance>;
export const Category: ModelCtor<CategoryInstance>;
export const Franchise: ModelCtor<FranchiseInstance>;
export const User: ModelCtor<UserInstance>;
export const RememberToken: ModelCtor<RememberTokenInstance>;
export const ShoppingCart: ModelCtor<ShoppingCartInstance>;
export const sequelize: Sequelize;
