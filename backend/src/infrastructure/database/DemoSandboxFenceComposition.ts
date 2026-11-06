import type { Sequelize } from 'sequelize';
import { RunFencedSandboxTransaction } from '../../application/use-cases/RunFencedSandboxTransaction';
import { createDemoSandboxFenceModel } from '../../database/models/DemoSandboxFence';
import { SequelizeSandboxFence } from '../persistence/SequelizeSandboxFence';
import { ScopedSequelizeUnitOfWork } from '../persistence/ScopedSequelizeUnitOfWork';

/** Isolated composition only; no schema creation, routing or lease authorization. */
export function createDemoSandboxFenceTransaction(
  connection: Sequelize,
  slotId: string,
): RunFencedSandboxTransaction {
  const model = createDemoSandboxFenceModel(connection);
  return new RunFencedSandboxTransaction(
    new ScopedSequelizeUnitOfWork(connection),
    new SequelizeSandboxFence(connection, slotId, model),
  );
}
