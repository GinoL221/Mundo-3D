/**
 * Order-history-specific real-DB test fixtures, layered on top of
 * `testDb.ts`'s generic Category/Franchise/Product/User primitives. Kept in
 * its own file (not folded into `orderTestDb.ts` or `testDb.ts`) to respect
 * the 250-line file cap — these helpers seed orders directly (via the real
 * `SequelizeOrderRepository.createWithItems`, inside a real transaction),
 * independent of the checkout flow's cart-based fixtures.
 */
import { SequelizeUnitOfWork } from '../../infrastructure/persistence/SequelizeUnitOfWork';
import { SequelizeOrderRepository } from '../../infrastructure/repositories/SequelizeOrderRepository';
import { NewOrderItemInput } from '../../domain/ports/OrderRepositoryPort';
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

export interface OrderHistoryFixture {
  userId: number;
  categoryId: number;
  franchiseId: number;
  productId: number;
  orderIds: number[];
}

/**
 * Seeds one buyer + one product, then creates one real order per entry of
 * `itemCounts`, each with that many line items (all against the same
 * product — item identity doesn't matter for order-history's count proof,
 * only that a real multi-item order exists). Orders are created via the
 * real `SequelizeOrderRepository.createWithItems` inside a real
 * transaction, so the resulting rows are indistinguishable from a real
 * checkout.
 */
export async function seedBuyerWithOrders(itemCounts: number[]): Promise<OrderHistoryFixture> {
  const userId = await seedTestUser();
  const categoryId = await createTestCategory();
  const franchiseId = await createTestFranchise();
  const productId = await createTestProduct(categoryId, franchiseId, { nameProduct: 'Order History Fixture Product' });

  const uow = new SequelizeUnitOfWork();
  const orderRepo = new SequelizeOrderRepository();
  const orderIds: number[] = [];

  for (let i = 0; i < itemCounts.length; i += 1) {
    const items: NewOrderItemInput[] = Array.from({ length: itemCounts[i] }, (_, itemIndex) => ({
      idProduct: productId,
      productName: `Order History Fixture Item ${i}-${itemIndex}`,
      quantity: 1,
      unitPrice: 10,
    }));
    const order = await uow.runInTransaction((tx) =>
      orderRepo.createWithItems({ idUser: userId, idempotencyKey: `order-history-fixture-${userId}-${i}`, items }, tx)
    );
    orderIds.push(order.idOrder);
  }

  return { userId, categoryId, franchiseId, productId, orderIds };
}

/** Deletes every Order/OrderItem/Product/Category/Franchise/User row this fixture created. */
export async function cleanupOrderHistoryFixture(fixture: OrderHistoryFixture): Promise<void> {
  const db = getTestDb();
  if (fixture.orderIds.length > 0) {
    await db.OrderItem.destroy({ where: { idOrder: fixture.orderIds } });
    await db.Order.destroy({ where: { idOrder: fixture.orderIds } });
  }
  await deleteTestProduct(fixture.productId);
  await deleteTestFranchise(fixture.franchiseId);
  await deleteTestCategory(fixture.categoryId);
  await deleteTestUser(fixture.userId);
}
