import { Sequelize } from 'sequelize';

export interface DemoSandboxConnectionSlot {
  slotId: string;
  database: string;
  username: string;
  password: string;
}

export interface DemoSandboxConnectionConfiguration {
  host: string;
  port: number;
  controlPlaneDatabase: string;
  slots: readonly DemoSandboxConnectionSlot[];
}

export interface DemoSandboxConnections {
  get(slotId: string): Sequelize;
}

const invalidConfiguration = 'Invalid demo sandbox connection configuration';
const systemDatabases = new Set(['mysql', 'information_schema', 'performance_schema', 'sys']);

function isIdentifier(value: string, maxLength: number): boolean {
  return typeof value === 'string' && value.length <= maxLength && /^[a-zA-Z0-9_]+$/.test(value);
}

function validateConfiguration(config: DemoSandboxConnectionConfiguration): void {
  if (
    !config ||
    typeof config.host !== 'string' ||
    !/^[a-zA-Z0-9.:-]+$/.test(config.host) ||
    !Number.isInteger(config.port) ||
    config.port < 1 ||
    config.port > 65535 ||
    !isIdentifier(config.controlPlaneDatabase, 64) ||
    !Array.isArray(config.slots) ||
    config.slots.length === 0
  ) {
    throw new Error(invalidConfiguration);
  }

  const slotIds = new Set<string>();
  const databases = new Set<string>();
  const usernames = new Set<string>();
  for (const slot of config.slots) {
    if (
      !slot ||
      typeof slot.slotId !== 'string' ||
      !slot.slotId.trim() ||
      slot.slotId !== slot.slotId.trim() ||
      !isIdentifier(slot.database, 64) ||
      !isIdentifier(slot.username, 32) ||
      typeof slot.password !== 'string' ||
      slot.password.length === 0
    ) {
      throw new Error(invalidConfiguration);
    }
    const database = slot.database.toLowerCase();
    const username = slot.username.toLowerCase();
    if (
      slotIds.has(slot.slotId) ||
      databases.has(database) ||
      usernames.has(username) ||
      database === config.controlPlaneDatabase.toLowerCase() ||
      systemDatabases.has(database) ||
      username === 'root'
    ) {
      throw new Error(invalidConfiguration);
    }
    slotIds.add(slot.slotId);
    databases.add(database);
    usernames.add(username);
  }
}

/** Constructs lazy, operator-configured connections; the caller owns closing them. */
export function createDemoSandboxConnections(
  config: DemoSandboxConnectionConfiguration,
): DemoSandboxConnections {
  validateConfiguration(config);
  const connections = new Map<string, Sequelize>();
  for (const slot of config.slots) {
    connections.set(
      slot.slotId,
      new Sequelize(slot.database, slot.username, slot.password, {
        dialect: 'mysql',
        host: config.host,
        port: config.port,
        logging: false,
        pool: { min: 0, max: 1 },
        retry: { max: 0 },
      }),
    );
  }
  return {
    get(slotId) {
      const connection = connections.get(slotId);
      if (!connection) {
        throw new Error('Demo sandbox connection is not configured');
      }
      return connection;
    },
  };
}
