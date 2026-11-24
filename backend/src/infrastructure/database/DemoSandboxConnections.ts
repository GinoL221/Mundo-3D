import { Options, Sequelize } from 'sequelize';

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
  controlPlaneUsername?: string;
  slots: readonly DemoSandboxConnectionSlot[];
  caCert?: string;
}

export interface DemoSandboxConnections {
  get(slotId: string): Sequelize;
}

export interface ManagedDemoSandboxConnections extends DemoSandboxConnections {
  closeAll(): Promise<void>;
}

export const DEMO_SANDBOX_MIN_SLOTS = 3;
export const DEMO_SANDBOX_MAX_SLOTS = 5;
export const DEMO_SANDBOX_MIN_JWT_SECRET_LENGTH = 32;

export interface DemoSandboxRuntimeConfiguration {
  enabled: true;
  jwtSecret: string;
  recoverOnBoot: boolean;
  connections: DemoSandboxConnectionConfiguration;
}

export type DemoSandboxEnvConfig = { enabled: false } | DemoSandboxRuntimeConfiguration;

const invalidConfiguration = 'Invalid demo sandbox connection configuration';
const systemDatabases = new Set(['mysql', 'information_schema', 'performance_schema', 'sys']);

function isIdentifier(value: string, maxLength: number): boolean {
  return typeof value === 'string' && value.length <= maxLength && /^[a-zA-Z0-9_]+$/.test(value);
}

function isSqlUsername(value: string, maxLength: number): boolean {
  return (
    typeof value === 'string' &&
    value.length <= maxLength &&
    /^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?$/.test(value)
  );
}

function isRootSqlUsername(userLower: string): boolean {
  return userLower === 'root' || userLower.endsWith('.root');
}

function parseStrictBoolean(value: string | undefined, name: string): boolean {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error(`${name} must be "true" or "false"`);
}

function parseSlotsJson(raw: string | undefined): DemoSandboxConnectionSlot[] {
  if (!raw?.trim()) {
    throw new Error('DEMO_SANDBOX_SLOTS_JSON is required when DEMO_SANDBOX_ENABLED=true');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('DEMO_SANDBOX_SLOTS_JSON must be valid JSON');
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length < DEMO_SANDBOX_MIN_SLOTS ||
    parsed.length > DEMO_SANDBOX_MAX_SLOTS
  ) {
    throw new Error(
      `DEMO_SANDBOX_SLOTS_JSON must contain between ${DEMO_SANDBOX_MIN_SLOTS} and ${DEMO_SANDBOX_MAX_SLOTS} slots`,
    );
  }
  return parsed.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(invalidConfiguration);
    }
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.slotId !== 'string' ||
      typeof candidate.database !== 'string' ||
      typeof candidate.username !== 'string' ||
      typeof candidate.password !== 'string'
    ) {
      throw new Error(invalidConfiguration);
    }
    return {
      slotId: candidate.slotId,
      database: candidate.database,
      username: candidate.username,
      password: candidate.password,
    };
  });
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
    (config.caCert !== undefined &&
      (typeof config.caCert !== 'string' || config.caCert.trim().length === 0)) ||
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
      !isSqlUsername(slot.username, 32) ||
      typeof slot.password !== 'string' ||
      slot.password.length === 0
    ) {
      throw new Error(invalidConfiguration);
    }
    const database = slot.database.toLowerCase();
    const username = slot.username.toLowerCase();
    const controlPlaneUsername = config.controlPlaneUsername?.toLowerCase();
    if (
      slotIds.has(slot.slotId) ||
      databases.has(database) ||
      usernames.has(username) ||
      database === config.controlPlaneDatabase.toLowerCase() ||
      (controlPlaneUsername !== undefined && username === controlPlaneUsername) ||
      systemDatabases.has(database) ||
      isRootSqlUsername(username)
    ) {
      throw new Error(invalidConfiguration);
    }
    slotIds.add(slot.slotId);
    databases.add(database);
    usernames.add(username);
  }
}

export function loadDemoSandboxConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DemoSandboxEnvConfig {
  if (!parseStrictBoolean(env.DEMO_SANDBOX_ENABLED, 'DEMO_SANDBOX_ENABLED')) {
    return { enabled: false };
  }
  const recoverOnBoot = parseStrictBoolean(
    env.DEMO_SANDBOX_RECOVER_ON_BOOT,
    'DEMO_SANDBOX_RECOVER_ON_BOOT',
  );
  const jwtSecret = env.DEMO_SANDBOX_JWT_SECRET?.trim() ?? '';
  if (!jwtSecret) {
    throw new Error('DEMO_SANDBOX_JWT_SECRET is required when DEMO_SANDBOX_ENABLED=true');
  }
  if (jwtSecret.length < DEMO_SANDBOX_MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `DEMO_SANDBOX_JWT_SECRET must be at least ${DEMO_SANDBOX_MIN_JWT_SECRET_LENGTH} characters long`,
    );
  }
  const mainSecret = env.JWT_SECRET?.trim() ?? '';
  if (env.DEMO_SANDBOX_JWT_SECRET === env.JWT_SECRET || (mainSecret && jwtSecret === mainSecret)) {
    throw new Error('DEMO_SANDBOX_JWT_SECRET must differ from JWT_SECRET');
  }

  const host = (env.DEMO_SANDBOX_DB_HOST || env.DB_HOST || '').trim();
  const portRaw = (env.DEMO_SANDBOX_DB_PORT || env.DB_PORT || '').trim();
  if (!/^\d+$/.test(portRaw)) {
    throw new Error(invalidConfiguration);
  }
  const caCert =
    env.DEMO_SANDBOX_DB_CA_CERT !== undefined && env.DEMO_SANDBOX_DB_CA_CERT !== ''
      ? env.DEMO_SANDBOX_DB_CA_CERT
      : env.DB_CA_CERT || undefined;
  if (env.NODE_ENV === 'production' && (!caCert || !caCert.trim())) {
    throw new Error('DB_CA_CERT or DEMO_SANDBOX_DB_CA_CERT is required in production');
  }

  const controlPlaneUsername = env.DB_USER?.trim() || undefined;
  const connections: DemoSandboxConnectionConfiguration = {
    host,
    port: Number(portRaw),
    controlPlaneDatabase: (env.DB_NAME || '').trim(),
    ...(controlPlaneUsername !== undefined ? { controlPlaneUsername } : {}),
    slots: parseSlotsJson(env.DEMO_SANDBOX_SLOTS_JSON),
    ...(caCert !== undefined ? { caCert } : {}),
  };
  validateConfiguration(connections);

  return { enabled: true, jwtSecret, recoverOnBoot, connections };
}

/** Constructs lazy, operator-configured connections; the caller owns closing them. */
export function createDemoSandboxConnections(
  config: DemoSandboxConnectionConfiguration,
): ManagedDemoSandboxConnections {
  validateConfiguration(config);
  const connections = new Map<string, Sequelize>();
  for (const slot of config.slots) {
    const options: Options = {
      dialect: 'mysql',
      host: config.host,
      port: config.port,
      logging: false,
      pool: { min: 0, max: 1 },
      retry: { max: 0 },
      ...(config.caCert
        ? { dialectOptions: { ssl: { ca: config.caCert, rejectUnauthorized: true } } }
        : {}),
    };
    connections.set(
      slot.slotId,
      new Sequelize(slot.database, slot.username, slot.password, options),
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
    async closeAll() {
      const results = await Promise.allSettled(
        Array.from(connections.values(), async (connection) => connection.close()),
      );
      const failure = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (failure) {
        throw failure.reason;
      }
    },
  };
}
