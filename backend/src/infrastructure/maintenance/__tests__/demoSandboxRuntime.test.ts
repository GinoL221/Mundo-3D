import type { Sequelize } from 'sequelize';
import { createDemoSandboxConnections } from '../../database/DemoSandboxConnections';
import { SequelizeDemoSandboxSlotRepository } from '../../repositories/SequelizeDemoSandboxSlotRepository';
import { startDemoSandboxScheduler } from '../demoSandboxScheduler';
import {
  getActiveDemoSandboxRuntime,
  setActiveDemoSandboxRuntime,
  startDemoSandboxRuntime,
} from '../demoSandboxRuntime';

jest.mock('../../database/DemoSandboxConnections', () => {
  const actual = jest.requireActual<typeof import('../../database/DemoSandboxConnections')>(
    '../../database/DemoSandboxConnections',
  );
  return {
    ...actual,
    createDemoSandboxConnections: jest.fn(),
  };
});

jest.mock('../../repositories/SequelizeDemoSandboxSlotRepository');
jest.mock('../demoSandboxScheduler');

describe('startDemoSandboxRuntime', () => {
  const validSlots = JSON.stringify([
    { slotId: 'slot-1', database: 'demo_slot_1', username: 'demo_u1', password: 'p1' },
    { slotId: 'slot-2', database: 'demo_slot_2', username: 'demo_u2', password: 'p2' },
    { slotId: 'slot-3', database: 'demo_slot_3', username: 'demo_u3', password: 'p3' },
  ]);
  const validEnv = (): NodeJS.ProcessEnv => ({
    NODE_ENV: 'development',
    JWT_SECRET: 'prod-secret-at-least-32-chars-long-0001',
    DB_HOST: '127.0.0.1',
    DB_PORT: '3306',
    DB_NAME: 'mundo_3d_control',
    DEMO_SANDBOX_ENABLED: 'true',
    DEMO_SANDBOX_JWT_SECRET: 'sandbox-secret-at-least-32-chars-long-01',
    DEMO_SANDBOX_SLOTS_JSON: validSlots,
  });
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const controlDb = {} as unknown as Sequelize;

  beforeEach(() => {
    jest.clearAllMocks();
    setActiveDemoSandboxRuntime(null);
  });

  it('returns null without opening connections when disabled', async () => {
    await expect(startDemoSandboxRuntime(controlDb, logger, {})).resolves.toBeNull();
    await expect(
      startDemoSandboxRuntime(controlDb, logger, { DEMO_SANDBOX_ENABLED: 'false' }),
    ).resolves.toBeNull();
    expect(createDemoSandboxConnections).not.toHaveBeenCalled();
  });

  it('fails closed on invalid DEMO_SANDBOX_ENABLED value', async () => {
    await expect(
      startDemoSandboxRuntime(controlDb, logger, { DEMO_SANDBOX_ENABLED: 'yes' }),
    ).rejects.toThrow('DEMO_SANDBOX_ENABLED');
    expect(createDemoSandboxConnections).not.toHaveBeenCalled();
  });

  it('registers slots, starts scheduler, and closes connections idempotently on stop()', async () => {
    const closeAll = jest.fn().mockResolvedValue(undefined);
    jest.mocked(createDemoSandboxConnections).mockReturnValue({ get: jest.fn(), closeAll });
    const registerConfiguredSlots = jest.fn().mockResolvedValue(undefined);
    jest
      .mocked(SequelizeDemoSandboxSlotRepository)
      .mockImplementation(
        () => ({ registerConfiguredSlots, listSlotsByStatus: jest.fn() }) as never,
      );
    const stopScheduler = jest.fn();
    jest
      .mocked(startDemoSandboxScheduler)
      .mockReturnValue({ ready: Promise.resolve(), stop: stopScheduler });

    const runtime = await startDemoSandboxRuntime(controlDb, logger, validEnv());
    expect(runtime).not.toBeNull();
    expect(getActiveDemoSandboxRuntime()).toBe(runtime);
    expect(runtime).toMatchObject({
      jwtSecret: 'sandbox-secret-at-least-32-chars-long-01',
      leasePolicy: { idleTimeoutMs: 15 * 60 * 1000, maxLifetimeMs: 45 * 60 * 1000 },
    });
    expect(runtime?.slotRepository).toBeDefined();
    expect(runtime?.connections).toBeDefined();
    expect(runtime?.repositories).toBeDefined();
    expect(registerConfiguredSlots).toHaveBeenCalledWith(['slot-1', 'slot-2', 'slot-3'], 5);
    expect(startDemoSandboxScheduler).toHaveBeenCalledWith(
      expect.objectContaining({ recoverInterruptedOnBoot: false, logger }),
    );

    await runtime!.ready;
    await runtime!.stop();
    expect(getActiveDemoSandboxRuntime()).toBeNull();
    await runtime!.stop();
    expect(stopScheduler).toHaveBeenCalledTimes(1);
    expect(closeAll).toHaveBeenCalledTimes(1);
  });

  it('closes opened slot connections if slot registration fails', async () => {
    const closeAll = jest.fn().mockResolvedValue(undefined);
    jest.mocked(createDemoSandboxConnections).mockReturnValue({ get: jest.fn(), closeAll });
    jest.mocked(SequelizeDemoSandboxSlotRepository).mockImplementation(
      () =>
        ({
          registerConfiguredSlots: jest.fn().mockRejectedValue(new Error('control-db-down')),
        }) as never,
    );

    await expect(startDemoSandboxRuntime(controlDb, logger, validEnv())).rejects.toThrow(
      'control-db-down',
    );
    expect(closeAll).toHaveBeenCalledTimes(1);
  });
});
