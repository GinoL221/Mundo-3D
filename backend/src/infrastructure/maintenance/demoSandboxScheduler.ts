import type { DemoSandboxResetResult } from '../../application/use-cases/ResetDemoSandboxSlotUseCase';
import type { DemoSandboxSlotSnapshot } from '../../domain/entities/DemoSandboxSlot';

export interface DemoSandboxSchedulerLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export interface DemoSandboxSchedulerDependencies {
  expireDueLeases: () => Promise<DemoSandboxSlotSnapshot[]>;
  listPendingSlots: () => Promise<DemoSandboxSlotSnapshot[]>;
  resetSlot: (slotId: string, leaseId: string) => Promise<DemoSandboxResetResult>;
  recoverInterruptedSlot: (
    slotId: string,
    leaseId: string,
    expectedResetAttemptId: string,
    operatorConfirmedWorkerStopped: boolean,
  ) => Promise<DemoSandboxResetResult>;
  recoverInterruptedOnBoot: boolean;
  logger: DemoSandboxSchedulerLogger;
  intervalMs?: number;
}

export interface DemoSandboxScheduler {
  ready: Promise<void>;
  stop(): void;
}

const DEFAULT_SWEEP_INTERVAL_MS = 30_000;

export function startDemoSandboxScheduler(
  deps: DemoSandboxSchedulerDependencies,
): DemoSandboxScheduler {
  const intervalMs = deps.intervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error('Demo sandbox sweep interval must be a finite positive number of milliseconds');
  }

  let stopped = false;
  let inFlight = false;

  const processPendingSlots = async (isBootPass: boolean): Promise<void> => {
    const pending = await deps.listPendingSlots();
    for (const slot of pending) {
      if (stopped) return;
      if (slot.status === 'draining' && slot.leaseId) {
        try {
          const result = await deps.resetSlot(slot.id, slot.leaseId);
          if (result === 'available') {
            deps.logger.info({ slotId: slot.id, result }, 'Demo sandbox slot reset completed');
          } else {
            deps.logger.warn({ slotId: slot.id, result }, 'Demo sandbox slot reset did not restore availability');
          }
        } catch (err) {
          deps.logger.error({ err, slotId: slot.id }, 'Failed to reset draining demo sandbox slot');
        }
        continue;
      }

      if (isBootPass && slot.status === 'resetting' && slot.leaseId && slot.resetAttemptId) {
        if (!deps.recoverInterruptedOnBoot) {
          deps.logger.warn(
            { slotId: slot.id, resetAttemptId: slot.resetAttemptId },
            'Interrupted demo sandbox slot left untouched; set DEMO_SANDBOX_RECOVER_ON_BOOT=true for single-instance startup recovery',
          );
          continue;
        }
        try {
          const result = await deps.recoverInterruptedSlot(
            slot.id,
            slot.leaseId,
            slot.resetAttemptId,
            true,
          );
          if (result === 'available') {
            deps.logger.info({ slotId: slot.id, result }, 'Recovered interrupted demo sandbox slot on boot');
          } else {
            deps.logger.warn(
              { slotId: slot.id, result },
              'Boot recovery for interrupted demo sandbox slot did not restore availability',
            );
          }
        } catch (err) {
          deps.logger.error({ err, slotId: slot.id }, 'Failed to recover interrupted demo sandbox slot');
        }
      }
    }
  };

  const runSweep = async (isBootPass: boolean): Promise<void> => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      await deps.expireDueLeases();
      if (!stopped) {
        await processPendingSlots(isBootPass);
      }
    } catch (err) {
      deps.logger.error({ err, isBootPass }, 'Demo sandbox maintenance sweep failed');
    } finally {
      inFlight = false;
    }
  };

  const ready = runSweep(true);
  const interval = setInterval(() => {
    void runSweep(false);
  }, intervalMs);
  if (typeof interval.unref === 'function') {
    interval.unref();
  }

  return {
    ready,
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
  };
}
