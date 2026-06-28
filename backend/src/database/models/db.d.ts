import { Model, ModelCtor, Sequelize } from 'sequelize';

export interface ProductAttributes {
  idProduct: number;
  idCategory: number;
  idFranchise: number;
  nameProduct: string;
  price: number;
  descriptionProduct: string | null;
  image: string | null;
}

export interface CategoryAttributes {
  idCategory: number;
  nameCategory: string;
}

export interface FranchiseAttributes {
  idFranchise: number;
  nameFranchise: string;
}

export interface UserAttributes {
  idUser: number;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  passwordUser: string;
  idRole?: number;
  category?: string;
}

export interface RememberTokenAttributes {
  idRememberToken: number;
  idUser: number;
  tokenHash: string;
  expiryDate: Date;
  createdAt: Date;
}

export interface ShoppingCartAttributes {
  idCart: number;
  idUser: number;
  idProduct: number;
  quantity: number;
  unitPrice: number;
  cartStatus: string;
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
