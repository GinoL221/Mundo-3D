/**
 * Order-checkout-specific real-DB test fixtures, layered on top of
 * `testDb.ts`'s generic Category/Franchise/Product/User primitives. Kept in
 * its own file (not folded into `testDb.ts`) to respect the 250-line file
 * cap — these helpers are checkout-specific, not generic reusable
 * primitives like the rest of `testDb.ts`.
 */
import { CartStatus } from '../../domain/entities/ShoppingCart';
import {
  getTestDb,
  seedTestUser,
  deleteTestUser,
  createTestCategory,
  createTestFranchise,
  createTestProduct,
  deleteTestProduct,
  deleteTestCategory,
  deleteTestFranchise,
} from './testDb';

export interface CheckoutFixture {
  userId: number;
  categoryId: number;
  franchiseId: number;
  productIds: number[];
}

/**
 * Seeds a user + one product per entry in `productStocks` (sharing one
 * Category/Franchise) + one pre-existing ACTIVE `ShoppingCart` row per
 * product, at the matching index in `quantities` (defaults to 1 each).
 *
 * `cartPriceOverrides[i]`, when present, seeds that cart row's `unitPrice`
 * at a value DIFFERENT from the product's current `price` — simulating a
 * product price change that happened after the item was added to the cart.
 * Any index without an override falls back to the product's own price
 * (the pre-existing behavior every other caller relies on).
 */
export async function seedCheckoutFixture(
  productStocks: number[],
  quantities: number[] = productStocks.map(() => 1),
  cartPriceOverrides: (number | undefined)[] = []
): Promise<CheckoutFixture> {
  const db = getTestDb();
  const userId = await seedTestUser();
  const categoryId = await createTestCategory();
  const franchiseId = await createTestFranchise();
  const productIds: number[] = [];

  for (let i = 0; i < productStocks.length; i += 1) {
    const productPrice = 10 + i;
    const cartUnitPrice = cartPriceOverrides[i] ?? productPrice;
    const productId = await createTestProduct(categoryId, franchiseId, {
      nameProduct: `Checkout Product ${i + 1}`,
      stock: productStocks[i],
      price: productPrice,
    });
    productIds.push(productId);
    await db.ShoppingCart.create({
      idUser: userId,
      idProduct: productId,
      quantity: quantities[i],
      unitPrice: cartUnitPrice,
      cartStatus: CartStatus.ACTIVE,
    });
  }

  return { userId, categoryId, franchiseId, productIds };
}

/** Deletes every Order/OrderItem/ShoppingCart/Product/Category/Franchise/User row this fixture created. */
export async function cleanupCheckoutFixture(fixture: CheckoutFixture): Promise<void> {
  const db = getTestDb();
  const orders = await db.Order.findAll({ where: { idUser: fixture.userId } });
  const orderIds = orders.map((order: { idOrder: number }) => order.idOrder);
  if (orderIds.length > 0) {
    await db.OrderItem.destroy({ where: { idOrder: orderIds } });
    await db.Order.destroy({ where: { idOrder: orderIds } });
  }
  await db.ShoppingCart.destroy({ where: { idUser: fixture.userId } });
  for (const productId of fixture.productIds) {
    await deleteTestProduct(productId);
  }
  await deleteTestFranchise(fixture.franchiseId);
  await deleteTestCategory(fixture.categoryId);
  await deleteTestUser(fixture.userId);
}

/** Counts the user's remaining ACTIVE cart rows directly from the DB. */
export async function readActiveCartCount(userId: number): Promise<number> {
  const db = getTestDb();
  return db.ShoppingCart.count({ where: { idUser: userId, cartStatus: 'ACTIVE' } });
}

/** Reads a single cart row (any status) directly by id, bypassing any cache. */
export async function readCartRowById(idCart: number): Promise<{ idCart: number; cartStatus: string } | null> {
  const db = getTestDb();
  const instance = await db.ShoppingCart.findByPk(idCart);
  return instance ? { idCart: instance.idCart, cartStatus: instance.cartStatus } : null;
}

/** Counts Order rows for a given user directly from the DB. */
export async function countOrdersForUser(userId: number): Promise<number> {
  const db = getTestDb();
  return db.Order.count({ where: { idUser: userId } });
}
