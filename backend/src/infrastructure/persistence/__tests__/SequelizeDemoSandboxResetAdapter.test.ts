import type { Sequelize, Transaction } from 'sequelize';
import { Role } from '../../../domain/Role';
import {
  buildDemoSandboxSlotEmails,
  DEMO_SANDBOX_EXPECTED_COUNTS,
  DEMO_SANDBOX_SEED_VERSION,
} from '../../database/demoSandboxSeedData';
import type { DemoSandboxConnections } from '../../database/DemoSandboxConnections';
import { SequelizeDemoSandboxResetAdapter } from '../SequelizeDemoSandboxResetAdapter';

function makeMockSlotGraph(slotId: string) {
  const emails = buildDemoSandboxSlotEmails(slotId);
  const callOrder: string[] = [];
  const makeTable = (name: string, countValue: number) => ({
    destroy: jest.fn(async () => {
      callOrder.push(`destroy:${name}`);
      return 0;
    }),
    bulkCreate: jest.fn(async (rows: unknown[]) => {
      callOrder.push(`bulkCreate:${name}:${rows.length}`);
      return rows;
    }),
    count: jest.fn(async () => countValue),
  });

  const models = {
    OrderItem: makeTable('OrderItem', DEMO_SANDBOX_EXPECTED_COUNTS.orderItems),
    Order: {
      ...makeTable('Order', DEMO_SANDBOX_EXPECTED_COUNTS.orders),
      findAll: jest.fn(async () => [
        { idOrder: 1, idUser: 1, idempotencyKey: 'demo-seed-order-1' },
      ]),
    },
    ShoppingCart: makeTable('ShoppingCart', 0),
    CustomCommissionRequest: makeTable('CustomCommissionRequest', 0),
    EmailConfirmationToken: makeTable('EmailConfirmationToken', 0),
    RememberToken: makeTable('RememberToken', 0),
    Product: makeTable('Product', DEMO_SANDBOX_EXPECTED_COUNTS.products),
    User: {
      ...makeTable('User', DEMO_SANDBOX_EXPECTED_COUNTS.users),
      findAll: jest.fn(async () => [
        { idRole: Role.USER, email: emails.buyer, emailVerifiedAt: new Date() },
        { idRole: Role.STAFF, email: emails.staff, emailVerifiedAt: new Date() },
      ]),
    },
    Category: makeTable('Category', DEMO_SANDBOX_EXPECTED_COUNTS.categories),
    Franchise: makeTable('Franchise', DEMO_SANDBOX_EXPECTED_COUNTS.franchises),
  };

  const fenceRow = {
    slotId,
    leaseId: null as string | null,
    generation: 1,
    state: 'open' as 'open' | 'fenced',
    resetAttemptId: null as string | null,
    update: jest.fn(async function (
      this: { state: string; leaseId: string | null; generation: number; resetAttemptId: string | null },
      patch: {
        state: 'open' | 'fenced';
        leaseId: null;
        generation?: number;
        resetAttemptId: string | null;
      },
    ) {
      this.state = patch.state;
      this.leaseId = patch.leaseId;
      if (patch.generation !== undefined) {
        this.generation = patch.generation;
      }
      this.resetAttemptId = patch.resetAttemptId;
    }),
  };

  const fenceModel = {
    findOne: jest.fn(async () => fenceRow),
    create: jest.fn(),
  };

  const receiptModel = {
    findOne: jest.fn(async () => null as Record<string, unknown> | null),
    create: jest.fn(async (row: Record<string, unknown>) => {
      callOrder.push('receipt:insert');
      return row;
    }),
  };

  const tx = { LOCK: { UPDATE: 'UPDATE', SHARE: 'SHARE' } } as unknown as Transaction;
  const connection = {
    transaction: jest.fn(async (work: (t: Transaction) => Promise<unknown>) => work(tx)),
  } as unknown as Sequelize;
  (tx as unknown as { sequelize: Sequelize }).sequelize = connection;

  return { connection, tx, models, fenceRow, fenceModel, receiptModel, callOrder };
}

function createAdapter(graph: ReturnType<typeof makeMockSlotGraph>) {
  const connections: DemoSandboxConnections = { get: jest.fn(() => graph.connection) };
  return new SequelizeDemoSandboxResetAdapter(connections, () => ({
    models: graph.models as never,
    fenceModel: graph.fenceModel as never,
    receiptModel: graph.receiptModel as never,
  }));
}

describe('SequelizeDemoSandboxResetAdapter', () => {
  const slotId = 'slot-1';
  const attemptId = '11111111-1111-4111-8111-111111111111';

  it('fences, deletes in FK order, seeds catalog products + USER/STAFF only, verifies, and writes receipt', async () => {
    const graph = makeMockSlotGraph(slotId);
    const adapter = createAdapter(graph);

    await adapter.reset(slotId, 1, attemptId);

    expect(graph.callOrder).toEqual([
      'destroy:OrderItem',
      'destroy:Order',
      'destroy:ShoppingCart',
      'destroy:CustomCommissionRequest',
      'destroy:EmailConfirmationToken',
      'destroy:RememberToken',
      'destroy:Product',
      'destroy:User',
      'destroy:Category',
      'destroy:Franchise',
      `bulkCreate:Category:${DEMO_SANDBOX_EXPECTED_COUNTS.categories}`,
      `bulkCreate:Franchise:${DEMO_SANDBOX_EXPECTED_COUNTS.franchises}`,
      `bulkCreate:Product:${DEMO_SANDBOX_EXPECTED_COUNTS.products}`,
      `bulkCreate:User:${DEMO_SANDBOX_EXPECTED_COUNTS.users}`,
      `bulkCreate:Order:${DEMO_SANDBOX_EXPECTED_COUNTS.orders}`,
      `bulkCreate:OrderItem:${DEMO_SANDBOX_EXPECTED_COUNTS.orderItems}`,
      'receipt:insert',
    ]);
    expect(graph.models.OrderItem.destroy).toHaveBeenCalledWith({
      where: {},
      transaction: graph.tx,
    });
    expect(graph.receiptModel.create).toHaveBeenCalledWith(
      {
        slotId,
        generation: 1,
        attemptId,
        seedVersion: DEMO_SANDBOX_SEED_VERSION,
        consumed: false,
      },
      { transaction: graph.tx },
    );
  });

  it('fails closed without writing a receipt when fence transition fails or verification detects ADMIN/residual rows', async () => {
    const staleGraph = makeMockSlotGraph(slotId);
    staleGraph.fenceRow.generation = 99;
    await expect(createAdapter(staleGraph).reset(slotId, 1, attemptId)).rejects.toThrow('fence');
    expect(staleGraph.receiptModel.create).not.toHaveBeenCalled();

    const adminGraph = makeMockSlotGraph(slotId);
    adminGraph.models.User.findAll.mockResolvedValueOnce([
      { idRole: Role.ADMIN, email: 'demo.buyer+slot-1@sandbox.mundo3d.invalid', emailVerifiedAt: new Date() },
      { idRole: Role.STAFF, email: 'demo.staff+slot-1@sandbox.mundo3d.invalid', emailVerifiedAt: new Date() },
    ]);
    await expect(createAdapter(adminGraph).reset(slotId, 1, attemptId)).rejects.toThrow(
      'verification failed',
    );
    expect(adminGraph.receiptModel.create).not.toHaveBeenCalled();
  });

  it('verify() requires valid slotId, matching committed receipt, and clean verified non-ADMIN state', async () => {
    const graph = makeMockSlotGraph(slotId);
    const adapter = createAdapter(graph);

    await expect(adapter.verify('   ', 1, attemptId)).resolves.toBe(false);
    await expect(adapter.verify(slotId, 1, attemptId)).resolves.toBe(false);

    graph.receiptModel.findOne.mockResolvedValue({
      attemptId,
      slotId,
      generation: 1,
      seedVersion: DEMO_SANDBOX_SEED_VERSION,
      consumed: false,
    });
    await expect(adapter.verify(slotId, 1, attemptId)).resolves.toBe(true);

    graph.models.Order.findAll.mockResolvedValueOnce([
      { idOrder: 1, idUser: 1, idempotencyKey: 'demo-seed-order-1' },
      { idOrder: 2, idUser: 1, idempotencyKey: 'visitor-order' },
    ]);
    await expect(adapter.verify(slotId, 1, attemptId)).resolves.toBe(false);

    graph.models.Order.findAll.mockResolvedValueOnce([
      { idOrder: 9, idUser: 1, idempotencyKey: 'visitor-order-only' },
    ]);
    await expect(adapter.verify(slotId, 1, attemptId)).resolves.toBe(false);

    graph.models.OrderItem.count.mockResolvedValueOnce(0);
    await expect(adapter.verify(slotId, 1, attemptId)).resolves.toBe(false);

    graph.models.Product.count.mockResolvedValueOnce(16);
    await expect(adapter.verify(slotId, 1, attemptId)).resolves.toBe(false);

    for (const badVerifiedAt of [null, undefined]) {
      graph.models.User.findAll.mockResolvedValueOnce([
        {
          idRole: Role.USER,
          email: 'demo.buyer+slot-1@sandbox.mundo3d.invalid',
          emailVerifiedAt: badVerifiedAt as unknown as Date,
        },
        {
          idRole: Role.STAFF,
          email: 'demo.staff+slot-1@sandbox.mundo3d.invalid',
          emailVerifiedAt: new Date(),
        },
      ]);
      await expect(adapter.verify(slotId, 1, attemptId)).resolves.toBe(false);
    }
  });

  it('advances fence generation on releaseFence() so consecutive reset cycles succeed without quarantine', async () => {
    const graph = makeMockSlotGraph(slotId);
    const adapter = createAdapter(graph);

    await adapter.reset(slotId, 1, attemptId);
    await adapter.releaseFence(slotId, 1, attemptId);
    expect(graph.fenceRow).toMatchObject({
      generation: 2,
      state: 'open',
      leaseId: null,
      resetAttemptId: null,
    });

    const secondAttempt = '22222222-2222-4222-8222-222222222222';
    await expect(adapter.reset(slotId, 2, secondAttempt)).resolves.toBeUndefined();
    expect(graph.fenceRow).toMatchObject({
      generation: 2,
      state: 'fenced',
      resetAttemptId: secondAttempt,
    });
  });
});
