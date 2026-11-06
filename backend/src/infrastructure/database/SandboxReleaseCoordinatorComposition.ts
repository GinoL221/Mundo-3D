import type { Sequelize } from 'sequelize';
import { createDemoSandboxResetReceiptModel } from '../../database/models/DemoSandboxResetReceipt';
import { createDemoSandboxReleaseOperationModel } from '../../database/models/DemoSandboxReleaseOperation';
import { CoordinateSandboxRelease } from './CoordinateSandboxRelease';
import { ScopedSequelizeUnitOfWork } from '../persistence/ScopedSequelizeUnitOfWork';
import { SequelizeSandboxReleaseSessionWriter } from '../persistence/SequelizeSandboxReleaseSessionWriter';
import { SequelizeReleaseConnectionIdentityReader } from '../persistence/SequelizeReleaseConnectionIdentityReader';
import {
  SequelizeSandboxReleaseControl,
  SequelizeSandboxReleaseFence,
} from '../persistence/SequelizeSandboxReleasePorts';
import { SequelizeSandboxReceiptConsumer } from '../persistence/SequelizeSandboxReceiptConsumer';
import { SequelizeSandboxReleaseOperationWriter } from '../persistence/SequelizeSandboxReleaseOperationWriter';
import { SequelizeAuthoritativeReleaseStateReader } from '../persistence/SequelizeAuthoritativeReleaseStateReader';

export interface SandboxReleaseCoordinatorConfig {
  /** The dedicated slot connection; the caller must not share it with other work. */
  readonly connection: Sequelize;
  readonly slotId: string;
  /** Operator-configured schema names; never caller input. */
  readonly controlSchema: string;
  readonly slotSchema: string;
}

const SCHEMA_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/**
 * Isolated composition root for the single-transaction release coordinator. It
 * creates no schema, registers no route and performs no I/O: it only wires the
 * reviewed adapters over one dedicated slot connection.
 *
 * Running it requires a coordinator principal permitted to read and write the
 * control lifecycle row and the slot fence, receipt, session and release rows on
 * one session. That principal and its grants are not designed or authorised
 * yet, so this composition must not be connected to a visitor-facing path.
 */
export function createSandboxReleaseCoordinator(
  config: SandboxReleaseCoordinatorConfig,
): CoordinateSandboxRelease {
  const { connection, slotId, controlSchema, slotSchema } = config;
  if (!SCHEMA_NAME.test(controlSchema) || !SCHEMA_NAME.test(slotSchema)) {
    throw new Error('Sandbox release schemas must be plain identifiers');
  }
  const receiptModel = createDemoSandboxResetReceiptModel(connection);
  const releaseModel = createDemoSandboxReleaseOperationModel(connection);

  return new CoordinateSandboxRelease({
    uow: new ScopedSequelizeUnitOfWork(connection),
    sessions: new SequelizeSandboxReleaseSessionWriter(connection, slotId),
    connectionId: new SequelizeReleaseConnectionIdentityReader(connection),
    control: new SequelizeSandboxReleaseControl(connection, slotId, controlSchema, slotSchema),
    fence: new SequelizeSandboxReleaseFence(connection, slotId, slotSchema),
    receipts: new SequelizeSandboxReceiptConsumer(connection, slotId, receiptModel),
    releaseRecorder: new SequelizeSandboxReleaseOperationWriter(connection, slotId, releaseModel),
    reader: new SequelizeAuthoritativeReleaseStateReader(
      connection,
      slotId,
      controlSchema,
      slotSchema,
    ),
  });
}
