import { QueryTypes, Sequelize } from 'sequelize';
import { initializeModelsForConnection } from '../../../database/models/registerModels';
import { createDemoSandboxConnections } from '../DemoSandboxConnections';
import { createDemoSandboxProductRepositories } from '../DemoSandboxProductRepositories';

jest.mock('../../../database/models/db', () => {
  throw new Error('Sandbox integration must not load the global database');
});
jest.mock('dotenv', () => {
  throw new Error('Sandbox integration must not load .env');
});

const container = 'm3d-sandbox-isolation-01a10377';
const databases = ['m3d_sandbox_verify_a', 'm3d_sandbox_verify_b'] as const;
const controlDatabase = 'm3d_sandbox_verify_control';
const usernames = ['m3d_verify_a', 'm3d_verify_b'] as const;
const opened: Sequelize[] = [];
let admin: Sequelize;
let registry: ReturnType<typeof createDemoSandboxProductRepositories>;
let slots: ReturnType<typeof createDemoSandboxConnections>;

function configuration() {
  const required = {
    M3D_SANDBOX_TEST_AUTHORIZATION: container,
    M3D_SANDBOX_TEST_HOST: '127.0.0.1',
    M3D_SANDBOX_TEST_PORT: '33316',
    M3D_SANDBOX_TEST_DATABASE_A: databases[0],
    M3D_SANDBOX_TEST_DATABASE_B: databases[1],
    M3D_SANDBOX_TEST_CONTROL_DATABASE: controlDatabase,
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
    throw new Error('Fresh sandbox passwords must be supplied explicitly');
  }
  if (new Set(passwords).size !== 3) {
    throw new Error('Sandbox setup and slot accounts require distinct passwords');
  }
  const uuid = process.env.M3D_SANDBOX_TEST_SERVER_UUID;
  if (!uuid || !/^[a-f0-9-]{36}$/.test(uuid)) {
    throw new Error('Explicit disposable sandbox server UUID required');
  }
  return { passwords: passwords as string[], uuid };
}

function setupConnection(database: string | undefined, password: string): Sequelize {
  const connection = new Sequelize(database ?? '', 'root', password, {
    dialect: 'mysql',
    host: '127.0.0.1',
    port: 33316,
    logging: false,
    pool: { min: 0, max: 1 },
    retry: { max: 0 },
  });
  opened.push(connection);
  return connection;
}

beforeAll(async () => {
  const { passwords, uuid } = configuration();
  admin = setupConnection(undefined, passwords[0]);
  const identity = await admin.query<{ uuid: string }>('SELECT @@server_uuid AS uuid', {
    type: QueryTypes.SELECT,
  });
  expect(identity).toEqual([{ uuid }]);

  // No IF NOT EXISTS, DROP, or shared test helper: setup requires fresh schemas.
  for (const database of [...databases, controlDatabase]) {
    await admin.query(`CREATE DATABASE \`${database}\``);
  }
  for (const [index, database] of databases.entries()) {
    const connection = setupConnection(database, passwords[0]);
    const models = initializeModelsForConnection(connection);
    await models.Category.sync();
    await models.Franchise.sync();
    await models.Product.sync();
    await models.Category.create({ nameCategory: 'Integration category' });
    await models.Franchise.create({ nameFranchise: 'Integration franchise' });
    try {
      await admin.query(
        `CREATE USER '${usernames[index]}'@'%' IDENTIFIED BY '${passwords[index + 1]}'`,
      );
    } catch {
      // A Sequelize setup error may contain its SQL, including the fresh password.
      throw new Error('Temporary sandbox account creation failed; credential SQL omitted');
    }
    await admin.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database}\`.* TO '${usernames[index]}'@'%'`,
    );
  }
  await admin.query(`CREATE TABLE \`${controlDatabase}\`.Sentinel (id INT PRIMARY KEY, value INT)`);
  await admin.query(`INSERT INTO \`${controlDatabase}\`.Sentinel VALUES (1, 7)`);
  slots = createDemoSandboxConnections({
    host: '127.0.0.1',
    port: 33316,
    controlPlaneDatabase: controlDatabase,
    slots: databases.map((database, index) => ({
      slotId: database,
      database,
      username: usernames[index],
      password: passwords[index + 1],
    })),
  });
  for (const database of databases) opened.push(slots.get(database));
  registry = createDemoSandboxProductRepositories(slots);
  for (const [index, database] of databases.entries()) {
    const identity = await slots.get(database).query<{
      current_database: string;
      current_account: string;
    }>('SELECT DATABASE() AS current_database, CURRENT_USER() AS current_account', {
      type: QueryTypes.SELECT,
    });
    expect(identity).toEqual([
      { current_database: database, current_account: `${usernames[index]}@%` },
    ]);
    await registry.get(database).create({
      nameProduct: `Fixture ${index}`,
      price: 20,
      descriptionProduct: 'Disposable integration fixture',
      image: null,
      idCategory: 1,
      idFranchise: 1,
      stock: 10,
    });
  }
});

afterAll(async () => {
  const results = await Promise.allSettled(opened.map((connection) => connection.close()));
  expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
});

async function snapshot() {
  const products = await Promise.all(databases.map((database) => registry.get(database).findAll()));
  const control = await admin.query(`SELECT * FROM \`${controlDatabase}\`.Sentinel ORDER BY id`, {
    type: QueryTypes.SELECT,
  });
  const counters = await admin.query(
    `SELECT TABLE_SCHEMA, TABLE_NAME, AUTO_INCREMENT FROM information_schema.TABLES
     WHERE TABLE_SCHEMA IN (:databases) ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    { replacements: { databases: [...databases, controlDatabase] }, type: QueryTypes.SELECT },
  );
  return { products, control, counters };
}

test('separates persisted products with identical IDs across slots', async () => {
  const a = registry.get(databases[0]);
  const b = registry.get(databases[1]);
  expect(await a.findAll()).toEqual([
    expect.objectContaining({ idProduct: 1, nameProduct: 'Fixture 0' }),
  ]);
  expect(await b.findAll()).toEqual([
    expect.objectContaining({ idProduct: 1, nameProduct: 'Fixture 1' }),
  ]);
  const before = await b.findAll();
  expect(await a.update(1, { nameProduct: 'Changed only in A' })).toEqual(
    expect.objectContaining({ nameProduct: 'Changed only in A' }),
  );
  expect(await a.findById(1)).toEqual(
    expect.objectContaining({ nameProduct: 'Changed only in A' }),
  );
  expect(await b.findAll()).toEqual(before);
});

test('MySQL rejects cross-slot and control-plane reads/writes without state or counter changes', async () => {
  const before = await snapshot();
  for (const [index, database] of databases.entries()) {
    const other = databases[1 - index];
    for (const sql of [
      `SELECT * FROM \`${other}\`.Product`,
      `UPDATE \`${other}\`.Product SET stock = 999`,
      `INSERT INTO \`${other}\`.Product (id_category, id_franchise, name_product, price, stock) VALUES (1, 1, 'Denied', 20, 1)`,
      `SELECT * FROM \`${controlDatabase}\`.Sentinel`,
      `UPDATE \`${controlDatabase}\`.Sentinel SET value = 999`,
    ]) {
      await expect(slots.get(database).query(sql)).rejects.toMatchObject({
        original: { code: 'ER_TABLEACCESS_DENIED_ERROR', errno: 1142 },
      });
    }
  }
  expect(await snapshot()).toEqual(before);
});

test('commits and rolls back real stock changes only within the owning slot', async () => {
  for (const database of databases) {
    const repository = registry.get(database);
    const uow = registry.getUnitOfWork(database);
    const before = await snapshot();
    const rollback = new Error('Deliberate disposable rollback');
    await expect(
      uow.runInTransaction(async (tx) => {
        expect(await repository.adjustStock(1, -2, tx)).toEqual(
          expect.objectContaining({ stock: 8 }),
        );
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await snapshot()).toEqual(before);
    await uow.runInTransaction(async (tx) => {
      expect(await repository.adjustStock(1, -1, tx)).toEqual(
        expect.objectContaining({ stock: 9 }),
      );
    });
    expect(await repository.findById(1)).toEqual(expect.objectContaining({ stock: 9 }));
    const other = databases.find((candidate) => candidate !== database);
    if (!other) throw new Error('Second isolated slot required');
    expect(await registry.get(other).findAll()).toEqual(before.products[databases.indexOf(other)]);
  }
});
