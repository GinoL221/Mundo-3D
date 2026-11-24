import crypto from 'node:crypto';
import type { Sequelize } from 'sequelize';
import { ExpireDemoSandboxLeasesUseCase } from '../../application/use-cases/ExpireDemoSandboxLeasesUseCase';
import { ResetDemoSandboxSlotUseCase } from '../../application/use-cases/ResetDemoSandboxSlotUseCase';
import type { DemoSandboxLeasePolicy } from '../../domain/entities/DemoSandboxSlot';
import type {
  DemoSandboxLeaseReleasePort,
  DemoSandboxSlotRepositoryPort,
} from '../../domain/ports/DemoSandboxSlotRepositoryPort';
import {
  createDemoSandboxConnections,
  DEMO_SANDBOX_MAX_SLOTS,
  loadDemoSandboxConfigFromEnv,
  type ManagedDemoSandboxConnections,
} from '../database/DemoSandboxConnections';
import {
  createDemoSandboxProductRepositories,
  type DemoSandboxProductRepositories,
} from '../database/DemoSandboxProductRepositories';
import { SequelizeDemoSandboxResetAdapter } from '../persistence/SequelizeDemoSandboxResetAdapter';
import { SequelizeDemoSandboxSlotRepository } from '../repositories/SequelizeDemoSandboxSlotRepository';
import {
  DEMO_SANDBOX_IDLE_TIMEOUT_MS,
  DEMO_SANDBOX_MAX_LIFETIME_MS,
} from '../security/demoSandboxCookies';
import { startDemoSandboxScheduler, type DemoSandboxSchedulerLogger } from './demoSandboxScheduler';

export interface DemoSandboxRuntimeHandle {
  ready: Promise<void>;
  stop(): Promise<void>;
  slotRepository: DemoSandboxSlotRepositoryPort & DemoSandboxLeaseReleasePort;
  connections: ManagedDemoSandboxConnections;
  repositories: DemoSandboxProductRepositories;
  jwtSecret: string;
  leasePolicy: DemoSandboxLeasePolicy;
}

let activeDemoSandboxRuntime: DemoSandboxRuntimeHandle | null = null;

export function getActiveDemoSandboxRuntime(): DemoSandboxRuntimeHandle | null {
  return activeDemoSandboxRuntime;
}

export function setActiveDemoSandboxRuntime(runtime: DemoSandboxRuntimeHandle | null): void {
  activeDemoSandboxRuntime = runtime;
}

/**
 * Bootstraps Demo Sandbox slot connections, slot registration, and expiry/reset
 * scheduling behind DEMO_SANDBOX_ENABLED=true. Returns null when disabled;
 * throws fail-closed on invalid configuration.
 */
export async function startDemoSandboxRuntime(
  controlSequelize: Sequelize,
  logger: DemoSandboxSchedulerLogger,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DemoSandboxRuntimeHandle | null> {
  const config = loadDemoSandboxConfigFromEnv(env);
  if (!config.enabled) {
    return null;
  }

  const connections = createDemoSandboxConnections(config.connections);
  const repository = new SequelizeDemoSandboxSlotRepository(controlSequelize);
  const slotIds = config.connections.slots.map((slot) => slot.slotId);

  try {
    await repository.registerConfiguredSlots(slotIds, DEMO_SANDBOX_MAX_SLOTS);
  } catch (err) {
    await connections.closeAll().catch(() => undefined);
    throw err;
  }

  const clock = { now: () => new Date() };
  const resetAttemptIds = { next: () => crypto.randomUUID() };
  const expireUseCase = new ExpireDemoSandboxLeasesUseCase(repository, clock);
  const resetAdapter = new SequelizeDemoSandboxResetAdapter(connections);
  const resetUseCase = new ResetDemoSandboxSlotUseCase(
    repository,
    resetAdapter,
    clock,
    resetAttemptIds,
  );

  const scheduler = startDemoSandboxScheduler({
    expireDueLeases: () => expireUseCase.execute(),
    listPendingSlots: () => repository.listSlotsByStatus(['draining', 'resetting']),
    resetSlot: (slotId, leaseId) => resetUseCase.execute(slotId, leaseId),
    recoverInterruptedSlot: (slotId, leaseId, expectedAttemptId, confirmed) =>
      resetUseCase.recoverInterrupted(slotId, leaseId, expectedAttemptId, confirmed),
    recoverInterruptedOnBoot: config.recoverOnBoot,
    logger,
  });

  const repositories = createDemoSandboxProductRepositories(connections);
  const leasePolicy: DemoSandboxLeasePolicy = {
    idleTimeoutMs: DEMO_SANDBOX_IDLE_TIMEOUT_MS,
    maxLifetimeMs: DEMO_SANDBOX_MAX_LIFETIME_MS,
  };

  let stopPromise: Promise<void> | null = null;
  const handle: DemoSandboxRuntimeHandle = {
    ready: scheduler.ready,
    slotRepository: repository,
    connections,
    repositories,
    jwtSecret: config.jwtSecret,
    leasePolicy,
    stop: () => {
      if (activeDemoSandboxRuntime === handle) {
        activeDemoSandboxRuntime = null;
      }
      if (!stopPromise) {
        scheduler.stop();
        stopPromise = connections.closeAll();
      }
      return stopPromise;
    },
  };
  activeDemoSandboxRuntime = handle;
  return handle;
}
