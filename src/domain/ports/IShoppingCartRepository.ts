import { ShoppingCart } from '../entities/ShoppingCart';

export interface IShoppingCartRepository {
  findByUserId(userId: number): Promise<ShoppingCart[]>;
  getDistinctCount(userId: number): Promise<number>;
}
