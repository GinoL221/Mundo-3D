import crypto from 'node:crypto';
import { QueryTypes, Sequelize } from 'sequelize';
import { AllocateDemoSandboxLeaseUseCase } from '../../../application/use-cases/AllocateDemoSandboxLeaseUseCase';
import { ExpireDemoSandboxLeasesUseCase } from '../../../application/use-cases/ExpireDemoSandboxLeasesUseCase';
import { ResetDemoSandboxSlotUseCase } from '../../../application/use-cases/ResetDemoSandboxSlotUseCase';
import { initializeModelsForConnection } from '../../../database/models/registerModels';
import { Role } from '../../../domain/Role';
import { SequelizeDemoSandboxResetAdapter } from '../../persistence/SequelizeDemoSandboxResetAdapter';
import { SequelizeDemoSandboxSlotRepository } from '../../repositories/SequelizeDemoSandboxSlotRepository';
import {
  createDemoSandboxConnections,
  type ManagedDemoSandboxConnections,
} from '../DemoSandboxConnections';
import {
  buildDemoSandboxSlotEmails,
  DEMO_SANDBOX_EXPECTED_COUNTS,
  DEMO_SANDBOX_SEED_VERSION,
} from '../demoSandboxSeedData';

jest.mock('../../../database/models/db', () => {
  throw new Error('Sandbox integration must not load the global database');
});
jest.mock('dotenv', () => {
  throw new Error('Sandbox integration must not load .env');
});

type MigrationModule = { up: (arg: { context: unknown }) => Promise<void> };

const CONTAINER = 'm3d-sandbox-cut1-mysql';
const CONTROL_DB = 'm3d_sandbox_cut1_control';
const SLOT_DBS = ['m3d_sandbox_cut1_slot_a', 'm3d_sandbox_cut1_slot_b'] as const;
const SLOT_IDS = ['slot-a', 'slot-b'] as const;
const SLOT_USERS = ['m3d_cut1_a', 'm3d_cut1_b'] as const;

const BUSINESS_MIGRATIONS: readonly MigrationModule[] = [
  require('../../../database/migrations/20260724000000-baseline'),
  require('../../../database/migrations/20260828000000-orders'),
  require('../../../database/migrations/20260901000000-refresh-token-rotation'),
  require('../../../database/migrations/20260902000000-email-confirmation'),
  require('../../../database/migrations/20260927000000-custom-commission-requests'),
  require('../../../database/migrations/20261127000000-custom-commission-requests-user-and-phone'),
];
const CONTROL_MIGRATION: MigrationModule = require('../../../database/migrations/20261026000000-demo-sandbox-slots');
const SLOT_CONTROL_MIGRATIONS: readonly MigrationModule[] = [
  require('../../../database/slot-migrations/20261102000000-demo-sandbox-fence'),
  require('../../../database/slot-migrations/20261103000000-demo-sandbox-reset-receipt'),
];

const opened: Sequelize[] = [];
let connections: ManagedDemoSandboxConnections;
let controlDb: Sequelize;
let slotRepo: SequelizeDemoSandboxSlotRepository;
let resetAdapter: SequelizeDemoSandboxResetAdapter;

function readConfig() {
  const required = {
    M3D_SANDBOX_TEST_AUTHORIZATION: CONTAINER,
    M3D_SANDBOX_TEST_HOST: '127.0.0.1',
    M3D_SANDBOX_TEST_PORT: '33317',
    M3D_SANDBOX_TEST_CONTROL_DATABASE: CONTROL_DB,
    M3D_SANDBOX_TEST_DATABASE_A: SLOT_DBS[0],
    M3D_SANDBOX_TEST_DATABASE_B: SLOT_DBS[1],
  };
  for (const [key, expected] of Object.entries(required)) {
    if (process.env[key] !== expected) {
      throw new Error(`Explicit disposable sandbox configuration required: ${key}`);
    }
  }
  const passwords = [
    process.env.M3D_SANDBOX_TEST_ADMIN_PASSWORD,
    process.env.M3D_SANDBOX_TEST_PASSWORD_A,
    process.env.M3D_SANDBOX_TEST_PASSWORD_B,
  ];
  if (passwords.some((value) => !value || !/^[a-f0-9]{64}$/.test(value))) {
    throw new Error('Fresh 64-hex sandbox passwords must be supplied explicitly');
  }
  if (new Set(passwords).size !== 3) {
    throw new Error('Admin and slot accounts require distinct passwords');
  }
  const uuid = process.env.M3D_SANDBOX_TEST_SERVER_UUID;
  if (!uuid || !/^[a-f0-9-]{36}$/.test(uuid)) {
    throw new Error('Explicit disposable sandbox server UUID required');
  }
  return { passwords: passwords as string[], uuid };
}

function adminConnection(password: string, database?: string): Sequelize {
  const instance = new Sequelize(database ?? '', 'root', password, {
    dialect: 'mysql',
    host: '127.0.0.1',
    port: 33317,
    logging: false,
    pool: { min: 0, max: 1 },
    retry: { max: 0 },
  });
  opened.push(instance);
  return instance;
}

async function countTable(conn: Sequelize, table: string): Promise<number> {
  const rows = await conn.query<{ n: number }>(`SELECT COUNT(*) AS n FROM \`${table}\``, {
    type: QueryTypes.SELECT,
  });
  return Number(rows[0].n);
}

beforeAll(async () => {
  const { passwords, uuid } = readConfig();
  const root = adminConnection(passwords[0]);
  const identity = await root.query<{ uuid: string }>('SELECT @@server_uuid AS uuid', {
    type: QueryTypes.SELECT,
  });
  expect(identity).toEqual([{ uuid }]);

  for (const dbName of [CONTROL_DB, ...SLOT_DBS]) {
    await root.query(`CREATE DATABASE \`${dbName}\``);
  }

  controlDb = adminConnection(passwords[0], CONTROL_DB);
  await CONTROL_MIGRATION.up({ context: controlDb.getQueryInterface() });

  for (const [index, dbName] of SLOT_DBS.entries()) {
    const slotAdmin = adminConnection(passwords[0], dbName);
    const qi = slotAdmin.getQueryInterface();
    for (const migration of BUSINESS_MIGRATIONS) {
      await migration.up({ context: qi });
    }
    for (const slotMigration of SLOT_CONTROL_MIGRATIONS) {
      await slotMigration.up({ context: qi });
    }
    try {
      await root.query(
        `CREATE USER '${SLOT_USERS[index]}'@'%' IDENTIFIED BY '${passwords[index + 1]}'`,
      );
    } catch {
      throw new Error('Disposable slot account creation failed; credential SQL omitted');
    }
    // DML-only privileges: proves reset uses transactional DELETE/INSERT, never DDL/TRUNCATE.
    await root.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${dbName}\`.* TO '${SLOT_USERS[index]}'@'%'`,
    );
  }

  connections = createDemoSandboxConnections({
    host: '127.0.0.1',
    port: 33317,
    controlPlaneDatabase: CONTROL_DB,
    slots: SLOT_IDS.map((slotId, index) => ({
      slotId,
      database: SLOT_DBS[index],
      username: SLOT_USERS[index],
      password: passwords[index + 1],
    })),
  });
  slotRepo = new SequelizeDemoSandboxSlotRepository(controlDb);
  await slotRepo.registerConfiguredSlots(SLOT_IDS, 5);
  resetAdapter = new SequelizeDemoSandboxResetAdapter(connections);
}, 60_000);

afterAll(async () => {
  if (connections) {
    await connections.closeAll();
  }
  await Promise.allSettled(opened.splice(0).map((conn) => conn.close()));
});

describe('SequelizeDemoSandboxResetAdapter on disposable MySQL 8.0', () => {
  it('resets a dirty slot transactionally with DML-only grants, strips ADMIN, writes receipt, and isolates sibling slot', async () => {
    const start = new Date('2026-11-23T12:00:00.000Z');
    const policy = { idleTimeoutMs: 60_000, maxLifetimeMs: 300_000 };
    const allocate = new AllocateDemoSandboxLeaseUseCase(
      slotRepo,
      policy,
      { now: () => start },
      { next: () => crypto.randomUUID() },
    );

    const leaseA = await allocate.execute();
    const leaseB = await allocate.execute();
    expect(leaseA?.id).toBe('slot-a');
    expect(leaseB?.id).toBe('slot-b');

    // Seed slot-b and place a sentinel order to prove slot-a reset never touches slot-b.
    await resetAdapter.reset('slot-b', 0, crypto.randomUUID());
    const modelsB = initializeModelsForConnection(connections.get('slot-b'));
    await modelsB.Order.create({
      idUser: 1,
      idempotencyKey: 'slot-b-sentinel',
      orderStatus: 'AWAITING_PAYMENT',
      paymentReference: null,
      createdAt: start,
    });

    // Dirty every business table in slot-a, including an injected ADMIN user.
    const modelsA = initializeModelsForConnection(connections.get('slot-a'));
    const cat = await modelsA.Category.create({ nameCategory: 'DirtyCat' });
    const fran = await modelsA.Franchise.create({ nameFranchise: 'DirtyFran' });
    const prod = await modelsA.Product.create({
      idCategory: cat.idCategory,
      idFranchise: fran.idFranchise,
      nameProduct: 'DirtyProduct',
      price: 99,
      descriptionProduct: 'Dirty',
      image: null,
      stock: 1,
    });
    const adminUser = await modelsA.User.create({
      firstName: 'Rogue',
      lastName: 'Admin',
      email: 'rogue.admin@sandbox.mundo3d.invalid',
      image: null,
      passwordUser: '$2a$10$tM.qhKiK276DG5gfyqqFR.FZnbof.TsKO6ZKasiRYLN/VHB/GF5au',
      idRole: Role.ADMIN,
      category: 'Admin',
      emailVerifiedAt: start,
    });
    await modelsA.ShoppingCart.create({
      idUser: adminUser.idUser,
      idProduct: prod.idProduct,
      quantity: 2,
      unitPrice: 99,
      cartStatus: 'ACTIVE',
    });
    const order = await modelsA.Order.create({
      idUser: adminUser.idUser,
      idempotencyKey: 'dirty-order',
      orderStatus: 'AWAITING_PAYMENT',
      paymentReference: null,
      createdAt: start,
    });
    await modelsA.OrderItem.create({
      idOrder: order.idOrder,
      idProduct: prod.idProduct,
      productName: 'DirtyProduct',
      quantity: 1,
      unitPrice: 99,
    });
    await modelsA.CustomCommissionRequest.create({
      name: 'Visitor',
      email: 'visitor@example.invalid',
      idea: 'Dirty idea',
      idProduct: prod.idProduct,
      createdAt: start,
      expiresAt: new Date(start.getTime() + 86_400_000),
    });
    await modelsA.RememberToken.create({
      idUser: adminUser.idUser,
      tokenHash: 'a'.repeat(64),
      expiryDate: new Date(start.getTime() + 86_400_000),
      createdAt: start,
      familyId: crypto.randomUUID(),
      supersededAt: null,
      successorHash: null,
      revokedAt: null,
    });
    await modelsA.EmailConfirmationToken.create({
      idUser: adminUser.idUser,
      tokenHash: 'b'.repeat(64),
      expiresAt: new Date(start.getTime() + 86_400_000),
      consumedAt: null,
      invalidatedAt: null,
      activeSlot: 1,
      createdAt: start,
    });

    const expiredAt = new Date(start.getTime() + 120_000);
    const expired = await new ExpireDemoSandboxLeasesUseCase(slotRepo, {
      now: () => expiredAt,
    }).execute();
    expect(expired.map((s) => s.id)).toEqual(['slot-a', 'slot-b']);

    const attemptA = crypto.randomUUID();
    const resetUseCase = new ResetDemoSandboxSlotUseCase(
      slotRepo,
      resetAdapter,
      { now: () => expiredAt },
      { next: () => attemptA },
    );
    await expect(resetUseCase.execute('slot-a', leaseA!.leaseId!)).resolves.toBe('available');

    const connA = connections.get('slot-a');
    expect(await countTable(connA, 'Category')).toBe(DEMO_SANDBOX_EXPECTED_COUNTS.categories);
    expect(await countTable(connA, 'Franchise')).toBe(DEMO_SANDBOX_EXPECTED_COUNTS.franchises);
    expect(await countTable(connA, 'Product')).toBe(DEMO_SANDBOX_EXPECTED_COUNTS.products);
    expect(await countTable(connA, 'User')).toBe(DEMO_SANDBOX_EXPECTED_COUNTS.users);
    expect(await countTable(connA, 'Order')).toBe(DEMO_SANDBOX_EXPECTED_COUNTS.orders);
    expect(await countTable(connA, 'OrderItem')).toBe(DEMO_SANDBOX_EXPECTED_COUNTS.orderItems);
    expect(await countTable(connA, 'CustomCommissionRequest')).toBe(
      DEMO_SANDBOX_EXPECTED_COUNTS.customCommissionRequests,
    );
    for (const emptyTable of ['ShoppingCart', 'RememberToken', 'EmailConfirmationToken']) {
      expect(await countTable(connA, emptyTable)).toBe(0);
    }

    const usersA = await connA.query<{
      id_role: number;
      email: string;
      email_verified_at: Date | null;
    }>('SELECT id_role, email, email_verified_at FROM `User` ORDER BY id_user ASC', {
      type: QueryTypes.SELECT,
    });
    const expectedEmails = buildDemoSandboxSlotEmails('slot-a');
    expect(usersA.map((u) => Number(u.id_role))).toEqual([Role.USER, Role.STAFF, Role.ADMIN]);
    expect(usersA.map((u) => u.email)).toEqual([
      expectedEmails.buyer,
      expectedEmails.staff,
      expectedEmails.admin,
    ]);
    expect(usersA.every((u) => u.email_verified_at !== null)).toBe(true);

    const receiptsA = await connA.query<{
      attempt_id: string;
      slot_id: string;
      generation: number;
      seed_version: string;
    }>('SELECT attempt_id, slot_id, generation, seed_version FROM `DemoSandboxResetReceipt`', {
      type: QueryTypes.SELECT,
    });
    expect(receiptsA).toEqual([
      {
        attempt_id: attemptA,
        slot_id: 'slot-a',
        generation: 0,
        seed_version: DEMO_SANDBOX_SEED_VERSION,
      },
    ]);

    // Sibling slot-b remained isolated with its seeded order + sentinel order intact.
    expect(await countTable(connections.get('slot-b'), 'Order')).toBe(
      DEMO_SANDBOX_EXPECTED_COUNTS.orders + 1,
    );
    const availableSlots = await slotRepo.listSlotsByStatus(['available']);
    expect(availableSlots.map((s) => ({ id: s.id, generation: s.generation }))).toEqual([
      { id: 'slot-a', generation: 1 },
    ]);

    // Second consecutive lease + expiry + reset cycle must advance DemoSandboxFence
    // cleanly from generation 1 -> 2 instead of quarantining on generation drift.
    const secondStart = new Date(expiredAt.getTime() + 10_000);
    const secondLease = await slotRepo.claimAvailableSlot(crypto.randomUUID(), secondStart, policy);
    expect(secondLease).toMatchObject({ id: 'slot-a', generation: 1 });
    const secondExpiredAt = new Date(secondStart.getTime() + 120_000);
    const secondExpired = await new ExpireDemoSandboxLeasesUseCase(slotRepo, {
      now: () => secondExpiredAt,
    }).execute();
    expect(secondExpired.map((s) => s.id)).toEqual(['slot-a']);

    const attemptA2 = crypto.randomUUID();
    const secondResetUseCase = new ResetDemoSandboxSlotUseCase(
      slotRepo,
      resetAdapter,
      { now: () => secondExpiredAt },
      { next: () => attemptA2 },
    );
    await expect(secondResetUseCase.execute('slot-a', secondLease!.leaseId!)).resolves.toBe(
      'available',
    );
    const afterSecondReset = await slotRepo.listSlotsByStatus(['available']);
    expect(afterSecondReset.map((s) => ({ id: s.id, generation: s.generation }))).toEqual([
      { id: 'slot-a', generation: 2 },
    ]);
    const fenceRows = await connA.query<{ generation: number; state: string }>(
      'SELECT generation, state FROM `DemoSandboxFence` WHERE slot_id = ?',
      { replacements: ['slot-a'], type: QueryTypes.SELECT },
    );
    expect(fenceRows).toEqual([{ generation: 2, state: 'open' }]);
  }, 30_000);

  it('rejects stale generations fail-closed without mutating data or writing a receipt', async () => {
    const staleAttempt = crypto.randomUUID();
    await expect(resetAdapter.reset('slot-a', 0, staleAttempt)).rejects.toThrow('fence');
    await expect(resetAdapter.reset('slot-a', 99, staleAttempt)).rejects.toThrow('fence');
    await expect(resetAdapter.verify('slot-a', 99, staleAttempt)).resolves.toBe(false);
    await expect(resetAdapter.verify('slot-a', 0, crypto.randomUUID())).resolves.toBe(false);
  });
});
