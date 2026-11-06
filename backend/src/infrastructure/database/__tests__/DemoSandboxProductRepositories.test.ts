import type { Sequelize } from 'sequelize';
import { createDemoSandboxProductRepositories } from '../DemoSandboxProductRepositories';
import { initializeModelsForConnection } from '../../../database/models/registerModels';

jest.mock('../../../database/models/db', () => {
  throw new Error('Scoped composition must not load the global database');
});
jest.mock('../../../database/models/registerModels', () => ({
  initializeModelsForConnection: jest.fn((sequelize: { label: string }) => ({
    sequelize,
    Product: { findAll: jest.fn().mockResolvedValue([]) },
    Order: {
      create: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      findAndCountAll: jest.fn(),
      update: jest.fn(),
    },
    CustomCommissionRequest: {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      destroy: jest.fn().mockResolvedValue(0),
    },
    EmailConfirmationToken: { findOne: jest.fn().mockResolvedValue(null) },
    RememberToken: { findOne: jest.fn().mockResolvedValue(null) },
    User: { findAll: jest.fn().mockResolvedValue([]) },
    OrderItem: { bulkCreate: jest.fn() },
    ShoppingCart: {
      findAll: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      destroy: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
    },
    Category: {
      findAll: jest
        .fn()
        .mockResolvedValue([{ idCategory: 1, nameCategory: `Category ${sequelize.label}` }]),
    },
    Franchise: {
      findAll: jest
        .fn()
        .mockResolvedValue([{ idFranchise: 1, nameFranchise: `Franchise ${sequelize.label}` }]),
    },
  })),
}));

beforeEach(() => jest.clearAllMocks());

test('shares the scoped graph and caches remember-token repositories per slot', async () => {
  const a = { label: 'a' } as unknown as Sequelize;
  const b = { label: 'b' } as unknown as Sequelize;
  const get = jest.fn((slot: string) => {
    if (slot === 'a') return a;
    if (slot === 'b') return b;
    throw new Error('Demo sandbox connection is not configured');
  });
  const repositories = createDemoSandboxProductRepositories({ get });
  expect(() => repositories.getRememberTokenRepository('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  expect(initializeModelsForConnection).not.toHaveBeenCalled();
  const tokenA = repositories.getRememberTokenRepository('a');
  const productA = repositories.get('a');
  const productB = repositories.get('b');
  const tokenB = repositories.getRememberTokenRepository('b');
  expect(repositories.getRememberTokenRepository('a')).toBe(tokenA);
  expect(repositories.getRememberTokenRepository('b')).toBe(tokenB);
  expect(tokenA).not.toBe(tokenB);
  expect(repositories.get('a')).toBe(productA);
  expect(repositories.get('b')).toBe(productB);
  expect(initializeModelsForConnection).toHaveBeenCalledTimes(2);
  const [graphA, graphB] = jest
    .mocked(initializeModelsForConnection)
    .mock.results.map((result) => result.value);
  expect(await tokenA.findByHash('hash-a')).toBeNull();
  expect(graphA.RememberToken.findOne).toHaveBeenCalledWith({ where: { tokenHash: 'hash-a' } });
  expect(graphB.RememberToken.findOne).not.toHaveBeenCalled();
  expect(await tokenB.findByHash('hash-b')).toBeNull();
  expect(graphB.RememberToken.findOne).toHaveBeenCalledWith({ where: { tokenHash: 'hash-b' } });
});

test('remember-token accessor accepts its own transaction and rejects another slot before SQL', async () => {
  const queryA = jest.fn().mockResolvedValue([undefined, 1]);
  const queryB = jest.fn().mockResolvedValue([undefined, 1]);
  const a = {
    label: 'a',
    query: queryA,
  } as unknown as Sequelize;
  const b = {
    label: 'b',
    query: queryB,
  } as unknown as Sequelize;
  const txA = { sequelize: a };
  const txB = { sequelize: b };
  (a as { transaction: unknown }).transaction = jest.fn(
    async (work: (tx: object) => Promise<unknown>) => work(txA),
  );
  (b as { transaction: unknown }).transaction = jest.fn(
    async (work: (tx: object) => Promise<unknown>) => work(txB),
  );
  const repositories = createDemoSandboxProductRepositories({
    get: (slot) => {
      if (slot === 'a') return a;
      if (slot === 'b') return b;
      throw new Error('Demo sandbox connection is not configured');
    },
  });
  const tokenA = repositories.getRememberTokenRepository('a');
  await repositories.getUnitOfWork('b').runInTransaction(async (tx) => {
    await expect(
      tokenA.claimRotation({ presentedHash: 'old', successorHash: 'new', tx }),
    ).rejects.toThrow('Transaction context is not active for this connection');
  });
  expect(queryA).not.toHaveBeenCalled();
  expect(queryB).not.toHaveBeenCalled();
  await repositories.getUnitOfWork('a').runInTransaction(async (tx) => {
    await expect(
      tokenA.claimRotation({ presentedHash: 'old', successorHash: 'new', tx }),
    ).resolves.toBe(true);
  });
  expect(queryA).toHaveBeenCalledTimes(1);
  expect(queryA.mock.calls[0][1].transaction).toBe(txA);
  expect(queryB).not.toHaveBeenCalled();
});

test('reuses repositories by slot and rejects unknown slots before registering models', async () => {
  const a = { label: 'a' } as unknown as Sequelize;
  const b = { label: 'b' } as unknown as Sequelize;
  const transactionA = { sequelize: a };
  const transactionB = { sequelize: b };
  const managed = (transaction: object) =>
    jest.fn(async (work: (tx: object) => Promise<unknown>) => work(transaction));
  (a as { transaction: unknown }).transaction = managed(transactionA);
  (b as { transaction: unknown }).transaction = managed(transactionB);
  const get = jest.fn((slotId: string) => {
    if (slotId === 'a') return a;
    if (slotId === 'b') return b;
    throw new Error('Demo sandbox connection is not configured');
  });
  const repositories = createDemoSandboxProductRepositories({ get });
  expect(() => repositories.get('unknown')).toThrow('Demo sandbox connection is not configured');
  expect(initializeModelsForConnection).not.toHaveBeenCalled();
  expect(() => repositories.getUnitOfWork('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  const uowA = repositories.getUnitOfWork('a');
  const uowB = repositories.getUnitOfWork('b');
  expect(repositories.getUnitOfWork('a')).toBe(uowA);
  expect(uowA).not.toBe(uowB);
  await uowA.runInTransaction(async (tx) => {
    expect(tx).toBe(transactionA);
  });
  await uowB.runInTransaction(async (tx) => {
    expect(tx).toBe(transactionB);
  });
  const repositoryA = repositories.get('a');
  const repositoryB = repositories.get('b');
  expect(repositoryA).not.toBe(repositoryB);
  expect(repositories.get('a')).toBe(repositoryA);
  expect(initializeModelsForConnection).toHaveBeenCalledTimes(2);
  expect(initializeModelsForConnection).toHaveBeenNthCalledWith(1, a);
  expect(initializeModelsForConnection).toHaveBeenNthCalledWith(2, b);
  expect(await repositoryA.findAll()).toEqual([]);
  expect(await repositoryB.findAll()).toEqual([]);
});

test('shares one graph per slot across product/category accessor order and rejects unknown categories', async () => {
  const a = { label: 'a' } as unknown as Sequelize;
  const b = { label: 'b' } as unknown as Sequelize;
  const get = jest.fn((slotId: string) => {
    if (slotId === 'a') return a;
    if (slotId === 'b') return b;
    throw new Error('Demo sandbox connection is not configured');
  });
  const repositories = createDemoSandboxProductRepositories({ get });
  expect(() => repositories.getCategoryRepository('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  expect(initializeModelsForConnection).not.toHaveBeenCalled();
  const categoryA = repositories.getCategoryRepository('a');
  const productA = repositories.get('a');
  const productB = repositories.get('b');
  const categoryB = repositories.getCategoryRepository('b');
  expect(repositories.getCategoryRepository('a')).toBe(categoryA);
  expect(repositories.getCategoryRepository('b')).toBe(categoryB);
  expect(repositories.get('a')).toBe(productA);
  expect(repositories.get('b')).toBe(productB);
  expect(categoryA).not.toBe(categoryB);
  expect(initializeModelsForConnection).toHaveBeenCalledTimes(2);
  expect(initializeModelsForConnection).toHaveBeenNthCalledWith(1, a);
  expect(initializeModelsForConnection).toHaveBeenNthCalledWith(2, b);
  const [graphA, graphB] = jest
    .mocked(initializeModelsForConnection)
    .mock.results.map((result) => result.value as ReturnType<typeof initializeModelsForConnection>);
  expect(graphA.Category.findAll).not.toHaveBeenCalled();
  expect(graphB.Category.findAll).not.toHaveBeenCalled();
  expect(await categoryA.findAll()).toEqual([{ idCategory: 1, nameCategory: 'Category a' }]);
  expect(graphA.Category.findAll).toHaveBeenCalledTimes(1);
  expect(graphB.Category.findAll).not.toHaveBeenCalled();
  expect(await categoryB.findAll()).toEqual([{ idCategory: 1, nameCategory: 'Category b' }]);
  expect(graphB.Category.findAll).toHaveBeenCalledTimes(1);
  expect(await productA.findAll()).toEqual([]);
  expect(await productB.findAll()).toEqual([]);
  expect(graphA.Product.findAll).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.arrayContaining([
        expect.objectContaining({ model: graphA.Category, as: 'Category' }),
      ]),
    }),
  );
  expect(graphB.Product.findAll).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.arrayContaining([
        expect.objectContaining({ model: graphB.Category, as: 'Category' }),
      ]),
    }),
  );
  expect(initializeModelsForConnection).toHaveBeenCalledTimes(2);
});

test('shares the catalog graph with franchises in every first-access order and rejects unknown slots', async () => {
  const labels = ['a', 'b', 'c'] as const;
  const connections = labels.map((label) => ({ label }) as unknown as Sequelize);
  const get = jest.fn((slotId: string) => {
    const index = labels.findIndex((label) => label === slotId);
    if (index === -1) throw new Error('Demo sandbox connection is not configured');
    return connections[index];
  });
  const repositories = createDemoSandboxProductRepositories({ get });
  expect(() => repositories.getFranchiseRepository('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  expect(initializeModelsForConnection).not.toHaveBeenCalled();
  for (const [index, slotId] of labels.entries()) {
    if (index === 0) repositories.getFranchiseRepository(slotId);
    if (index === 1) repositories.getCategoryRepository(slotId);
    if (index === 2) repositories.get(slotId);
    const franchise = repositories.getFranchiseRepository(slotId);
    const category = repositories.getCategoryRepository(slotId);
    const product = repositories.get(slotId);
    expect(repositories.getFranchiseRepository(slotId)).toBe(franchise);
    expect(repositories.getCategoryRepository(slotId)).toBe(category);
    expect(repositories.get(slotId)).toBe(product);
    expect(initializeModelsForConnection).toHaveBeenCalledTimes(index + 1);
    expect(initializeModelsForConnection).toHaveBeenNthCalledWith(index + 1, connections[index]);
    const graph = jest.mocked(initializeModelsForConnection).mock.results[index]
      .value as ReturnType<typeof initializeModelsForConnection>;
    expect(await franchise.findAll()).toEqual([
      { idFranchise: 1, nameFranchise: `Franchise ${slotId}` },
    ]);
    expect(graph.Franchise.findAll).toHaveBeenCalledTimes(1);
    expect(await category.findAll()).toEqual([
      { idCategory: 1, nameCategory: `Category ${slotId}` },
    ]);
    expect(await product.findAll()).toEqual([]);
    expect(graph.Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ model: graph.Category, as: 'Category' }),
          expect.objectContaining({ model: graph.Franchise, as: 'Franchise' }),
        ]),
      }),
    );
  }
  expect(initializeModelsForConnection).toHaveBeenCalledTimes(3);
  const beforeUnknown = jest.mocked(initializeModelsForConnection).mock.calls.length;
  expect(() => repositories.getFranchiseRepository('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  expect(initializeModelsForConnection).toHaveBeenCalledTimes(beforeUnknown);
  expect(repositories.getFranchiseRepository('a')).not.toBe(
    repositories.getFranchiseRepository('b'),
  );
});

test('shares cart repositories with the catalog graph in every first-access order', async () => {
  const labels = ['cart-first', 'product-first', 'category-first', 'franchise-first'] as const;
  const connections = labels.map((label) => ({ label }) as unknown as Sequelize);
  const get = jest.fn((slotId: string) => {
    const index = labels.findIndex((label) => label === slotId);
    if (index === -1) throw new Error('Demo sandbox connection is not configured');
    return connections[index];
  });
  const repositories = createDemoSandboxProductRepositories({ get });
  expect(() => repositories.getShoppingCartRepository('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  expect(initializeModelsForConnection).not.toHaveBeenCalled();

  for (const [index, slotId] of labels.entries()) {
    if (index === 0) repositories.getShoppingCartRepository(slotId);
    if (index === 1) repositories.get(slotId);
    if (index === 2) repositories.getCategoryRepository(slotId);
    if (index === 3) repositories.getFranchiseRepository(slotId);

    const cart = repositories.getShoppingCartRepository(slotId);
    const product = repositories.get(slotId);
    const category = repositories.getCategoryRepository(slotId);
    const franchise = repositories.getFranchiseRepository(slotId);
    expect(repositories.getShoppingCartRepository(slotId)).toBe(cart);
    expect(repositories.get(slotId)).toBe(product);
    expect(repositories.getCategoryRepository(slotId)).toBe(category);
    expect(repositories.getFranchiseRepository(slotId)).toBe(franchise);

    const graph = jest.mocked(initializeModelsForConnection).mock.results[index]
      .value as ReturnType<typeof initializeModelsForConnection>;
    expect(await cart.findByUserId(index + 1)).toEqual([]);
    expect(graph.ShoppingCart.findAll).toHaveBeenCalledWith({
      where: { idUser: index + 1 },
      include: [{ model: graph.Product, as: 'product' }],
    });
    expect(await product.findAll()).toEqual([]);
    expect(graph.Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ model: graph.Category, as: 'Category' }),
          expect.objectContaining({ model: graph.Franchise, as: 'Franchise' }),
        ]),
      }),
    );
    expect(initializeModelsForConnection).toHaveBeenCalledTimes(index + 1);
  }

  expect(initializeModelsForConnection).toHaveBeenCalledTimes(labels.length);
  expect(repositories.getShoppingCartRepository(labels[0])).not.toBe(
    repositories.getShoppingCartRepository(labels[1]),
  );
});

test('shares order repositories with the catalog graph in every first-access order', async () => {
  const labels = [
    'order-first',
    'cart-first',
    'product-first',
    'category-first',
    'franchise-first',
  ] as const;
  const connections = labels.map((label) => ({ label }) as unknown as Sequelize);
  const get = jest.fn((slotId: string) => {
    const index = labels.findIndex((label) => label === slotId);
    if (index === -1) throw new Error('Demo sandbox connection is not configured');
    return connections[index];
  });
  const repositories = createDemoSandboxProductRepositories({ get });
  expect(() => repositories.getOrderRepository('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  expect(initializeModelsForConnection).not.toHaveBeenCalled();

  for (const [index, slotId] of labels.entries()) {
    if (index === 0) repositories.getOrderRepository(slotId);
    if (index === 1) repositories.getShoppingCartRepository(slotId);
    if (index === 2) repositories.get(slotId);
    if (index === 3) repositories.getCategoryRepository(slotId);
    if (index === 4) repositories.getFranchiseRepository(slotId);

    const order = repositories.getOrderRepository(slotId);
    const product = repositories.get(slotId);
    const category = repositories.getCategoryRepository(slotId);
    const franchise = repositories.getFranchiseRepository(slotId);
    const cart = repositories.getShoppingCartRepository(slotId);
    expect(repositories.getOrderRepository(slotId)).toBe(order);
    expect(repositories.get(slotId)).toBe(product);
    expect(repositories.getCategoryRepository(slotId)).toBe(category);
    expect(repositories.getFranchiseRepository(slotId)).toBe(franchise);
    expect(repositories.getShoppingCartRepository(slotId)).toBe(cart);

    const graph = jest.mocked(initializeModelsForConnection).mock.results[index]
      .value as ReturnType<typeof initializeModelsForConnection>;
    expect(await order.findAll()).toEqual([]);
    expect(graph.Order.findAll).toHaveBeenCalledWith({
      include: [{ model: graph.OrderItem, as: 'items' }],
      order: [['idOrder', 'DESC']],
      limit: 100,
    });
    expect(initializeModelsForConnection).toHaveBeenCalledTimes(index + 1);
  }

  expect(initializeModelsForConnection).toHaveBeenCalledTimes(labels.length);
  expect(repositories.getOrderRepository(labels[0])).not.toBe(
    repositories.getOrderRepository(labels[1]),
  );
});

test('shares cached commission models across all first-access orders and rejects unknown slots', async () => {
  const connections = Array.from({ length: 6 }, (_, label) => ({ label }) as unknown as Sequelize);
  const registry = createDemoSandboxProductRepositories({
    get(slotId: string) {
      const connection = connections[Number(slotId)];
      if (!connection) throw new Error('Demo sandbox connection is not configured');
      return connection;
    },
  });
  expect(() => registry.getCustomCommissionRequestRepository('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  expect(initializeModelsForConnection).not.toHaveBeenCalled();
  const now = new Date('2026-10-01T00:00:00Z');
  for (let index = 0; index < connections.length; index++) {
    const slot = String(index);
    const accessors = [
      registry.getCustomCommissionRequestRepository,
      registry.get,
      registry.getCategoryRepository,
      registry.getFranchiseRepository,
      registry.getShoppingCartRepository,
      registry.getOrderRepository,
    ];
    accessors[index](slot);
    const requests = registry.getCustomCommissionRequestRepository(slot);
    for (const accessor of accessors) accessor(slot);
    expect(registry.getCustomCommissionRequestRepository(slot)).toBe(requests);
    expect(initializeModelsForConnection).toHaveBeenCalledTimes(index + 1);
    expect(initializeModelsForConnection).toHaveBeenNthCalledWith(index + 1, connections[index]);
    const graph = jest.mocked(initializeModelsForConnection).mock.results[index]
      .value as ReturnType<typeof initializeModelsForConnection>;
    await expect(requests.listActive(now)).resolves.toEqual([]);
    await expect(requests.purgeExpired(now)).resolves.toBe(0);
    expect(graph.CustomCommissionRequest.findAll).toHaveBeenCalledTimes(1);
    expect(graph.CustomCommissionRequest.destroy).toHaveBeenCalledTimes(1);
  }
  expect(registry.getCustomCommissionRequestRepository('0')).not.toBe(
    registry.getCustomCommissionRequestRepository('1'),
  );
  expect(() => registry.getCustomCommissionRequestRepository('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  expect(initializeModelsForConnection).toHaveBeenCalledTimes(6);
});

test('caches per-slot user adapters on the shared graph', async () => {
  const connections = [{}, {}] as unknown as Sequelize[];
  const registry = createDemoSandboxProductRepositories({
    get(id: string) {
      if (id === 'a') return connections[0];
      if (id === 'b') return connections[1];
      throw new Error('Demo sandbox connection is not configured');
    },
  });
  expect(() => registry.getUserRepository('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  expect(initializeModelsForConnection).not.toHaveBeenCalled();
  const userA = registry.getUserRepository('a');
  registry.get('a');
  registry.get('b');
  const userB = registry.getUserRepository('b');
  expect(registry.getUserRepository('a')).toBe(userA);
  expect(userA).not.toBe(userB);
  expect(initializeModelsForConnection).toHaveBeenCalledTimes(2);
  const [a, b] = jest
    .mocked(initializeModelsForConnection)
    .mock.results.map((result) => result.value as ReturnType<typeof initializeModelsForConnection>);
  await userA.findAll();
  expect(a.User.findAll).toHaveBeenCalledTimes(1);
  expect(b.User.findAll).not.toHaveBeenCalled();
  await userB.findAll();
  expect(b.User.findAll).toHaveBeenCalledTimes(1);
});

test('shares and caches slot-local confirmation token repositories', async () => {
  const a = {} as Sequelize;
  const b = {} as Sequelize;
  const registry = createDemoSandboxProductRepositories({
    get(id: string) {
      if (id === 'a') return a;
      if (id === 'b') return b;
      throw new Error('Demo sandbox connection is not configured');
    },
  });
  expect(() => registry.getEmailConfirmationTokenRepository('unknown')).toThrow(
    'Demo sandbox connection is not configured',
  );
  expect(initializeModelsForConnection).not.toHaveBeenCalled();
  const first = registry.getEmailConfirmationTokenRepository('a');
  registry.getUserRepository('a');
  registry.getUserRepository('b');
  const second = registry.getEmailConfirmationTokenRepository('b');
  expect(registry.getEmailConfirmationTokenRepository('a')).toBe(first);
  expect(first).not.toBe(second);
  expect(initializeModelsForConnection).toHaveBeenCalledTimes(2);
  const [graphA, graphB] = jest
    .mocked(initializeModelsForConnection)
    .mock.results.map((result) => result.value as ReturnType<typeof initializeModelsForConnection>);
  await expect(first.findUserIdByTokenHash('hash')).resolves.toBeNull();
  expect(graphA.EmailConfirmationToken.findOne).toHaveBeenCalledWith({
    where: { tokenHash: 'hash' },
    attributes: ['idUser'],
  });
  expect(graphB.EmailConfirmationToken.findOne).not.toHaveBeenCalled();
});
