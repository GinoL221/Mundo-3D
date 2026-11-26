import type { ModelStatic, Sequelize, Transaction } from 'sequelize';
import {
  RunFencedSandboxReset,
  type SandboxResetIdentity,
  type SandboxTransactionalReset,
} from '../../application/use-cases/RunFencedSandboxReset';
import {
  createDemoSandboxFenceModel,
  type DemoSandboxFenceRecord,
} from '../../database/models/DemoSandboxFence';
import {
  createDemoSandboxResetReceiptModel,
  type DemoSandboxResetReceiptRecord,
} from '../../database/models/DemoSandboxResetReceipt';
import { initializeModelsForConnection } from '../../database/models/registerModels';
import type { DemoSandboxResetPort } from '../../domain/ports/DemoSandboxResetPort';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { Role } from '../../domain/Role';
import type { DemoSandboxConnections } from '../database/DemoSandboxConnections';
import {
  buildDemoSandboxSeedData,
  buildDemoSandboxSlotEmails,
  DEMO_SANDBOX_EXPECTED_COUNTS,
  DEMO_SANDBOX_SEED_VERSION,
} from '../database/demoSandboxSeedData';
import { resolveScopedTransaction } from './scopedTransactionContext';
import { ScopedSequelizeUnitOfWork } from './ScopedSequelizeUnitOfWork';
import { SequelizeSandboxReceiptWriter } from './SequelizeSandboxReceiptWriter';
import { SequelizeSandboxResetFence } from './SequelizeSandboxResetFence';

export interface SandboxSlotModelGraph {
  readonly models: ReturnType<typeof initializeModelsForConnection>;
  readonly fenceModel: ModelStatic<DemoSandboxFenceRecord>;
  readonly receiptModel: ModelStatic<DemoSandboxResetReceiptRecord>;
}

type SlotGraphFactory = (connection: Sequelize) => SandboxSlotModelGraph;

function defaultGraphFactory(connection: Sequelize): SandboxSlotModelGraph {
  return {
    models: initializeModelsForConnection(connection),
    fenceModel: createDemoSandboxFenceModel(connection),
    receiptModel: createDemoSandboxResetReceiptModel(connection),
  };
}

/**
 * Concrete DemoSandboxResetPort adapter: fences the slot, wipes and re-seeds all
 * business tables inside one fenced transaction (DELETE FROM in child->parent FK
 * order, never auto-committing TRUNCATE), verifies clean state prior to writing
 * `DemoSandboxResetReceipt`, and re-verifies committed receipt + state on verify().
 */
export class SequelizeDemoSandboxResetAdapter implements DemoSandboxResetPort {
  private readonly graphs = new WeakMap<Sequelize, SandboxSlotModelGraph>();

  constructor(
    private readonly connections: DemoSandboxConnections,
    private readonly graphFactory: SlotGraphFactory = defaultGraphFactory,
  ) {}

  async reset(slotId: string, generation: number, resetAttemptId: string): Promise<void> {
    const connection = this.connections.get(slotId);
    const graph = this.getGraph(connection);
    const identity: SandboxResetIdentity = {
      slotId,
      generation,
      attemptId: resetAttemptId,
      seedVersion: DEMO_SANDBOX_SEED_VERSION,
    };

    const fence = new SequelizeSandboxResetFence(
      connection,
      slotId,
      graph.fenceModel,
      graph.receiptModel,
    );
    if (!(await fence.fenceForReset(identity))) {
      throw new Error('Sandbox reset fence transition rejected');
    }

    const transactionalReset: SandboxTransactionalReset = {
      run: async (current: SandboxResetIdentity, context: TransactionContext): Promise<void> => {
        const transaction = resolveScopedTransaction(context, connection);
        if (!transaction) {
          throw new Error('Transaction context is required');
        }
        await this.wipeAndSeed(graph.models, current.slotId, transaction);
      },
      verify: async (
        current: SandboxResetIdentity,
        context: TransactionContext,
      ): Promise<boolean> => {
        const transaction = resolveScopedTransaction(context, connection);
        if (!transaction) {
          throw new Error('Transaction context is required');
        }
        return this.verifyCleanState(graph.models, current.slotId, transaction);
      },
    };

    const runner = new RunFencedSandboxReset(
      new ScopedSequelizeUnitOfWork(connection),
      fence,
      new SequelizeSandboxReceiptWriter(connection, slotId, graph.receiptModel),
      transactionalReset,
    );
    await runner.execute(identity);
  }

  async verify(slotId: string, generation: number, resetAttemptId: string): Promise<boolean> {
    if (!resetAttemptId.trim() || !Number.isSafeInteger(generation) || generation < 0) {
      return false;
    }
    try {
      buildDemoSandboxSlotEmails(slotId);
    } catch {
      return false;
    }
    const connection = this.connections.get(slotId);
    const graph = this.getGraph(connection);
    const receipt = await graph.receiptModel.findOne({
      where: {
        attemptId: resetAttemptId,
        slotId,
        generation,
        seedVersion: DEMO_SANDBOX_SEED_VERSION,
      },
    });
    if (!receipt) {
      return false;
    }
    return this.verifyCleanState(graph.models, slotId);
  }

  async releaseFence(
    slotId: string,
    completedGeneration: number,
    resetAttemptId: string,
  ): Promise<void> {
    const connection = this.connections.get(slotId);
    const graph = this.getGraph(connection);
    const fence = new SequelizeSandboxResetFence(
      connection,
      slotId,
      graph.fenceModel,
      graph.receiptModel,
    );
    await fence.releaseFence({
      slotId,
      generation: completedGeneration,
      attemptId: resetAttemptId,
    });
  }

  private getGraph(connection: Sequelize): SandboxSlotModelGraph {
    const existing = this.graphs.get(connection);
    if (existing) {
      return existing;
    }
    const created = this.graphFactory(connection);
    this.graphs.set(connection, created);
    return created;
  }

  private async wipeAndSeed(
    models: SandboxSlotModelGraph['models'],
    slotId: string,
    transaction: Transaction,
  ): Promise<void> {
    const seed = buildDemoSandboxSeedData(slotId);

    // Child-to-parent FK order using transactional DELETE (never TRUNCATE/DDL).
    await models.OrderItem.destroy({ where: {}, transaction });
    await models.Order.destroy({ where: {}, transaction });
    await models.ShoppingCart.destroy({ where: {}, transaction });
    await models.CustomCommissionRequest.destroy({ where: {}, transaction });
    await models.EmailConfirmationToken.destroy({ where: {}, transaction });
    await models.RememberToken.destroy({ where: {}, transaction });
    await models.Product.destroy({ where: {}, transaction });
    await models.User.destroy({ where: {}, transaction });
    await models.Category.destroy({ where: {}, transaction });
    await models.Franchise.destroy({ where: {}, transaction });

    await models.Category.bulkCreate(seed.categories, { transaction });
    await models.Franchise.bulkCreate(seed.franchises, { transaction });
    await models.Product.bulkCreate(seed.products, { transaction });
    await models.User.bulkCreate(seed.users, { transaction });
  }

  private async verifyCleanState(
    models: SandboxSlotModelGraph['models'],
    slotId: string,
    transaction?: Transaction,
  ): Promise<boolean> {
    const opts = transaction ? { transaction } : {};
    const residualCounts = await Promise.all([
      models.OrderItem.count(opts),
      models.Order.count(opts),
      models.ShoppingCart.count(opts),
      models.CustomCommissionRequest.count(opts),
      models.EmailConfirmationToken.count(opts),
      models.RememberToken.count(opts),
    ]);
    if (residualCounts.some((count) => count !== 0)) {
      return false;
    }

    const [categories, franchises, products, users] = await Promise.all([
      models.Category.count(opts),
      models.Franchise.count(opts),
      models.Product.count(opts),
      models.User.findAll({ attributes: ['idRole', 'email', 'emailVerifiedAt'], ...opts }),
    ]);

    if (
      categories !== DEMO_SANDBOX_EXPECTED_COUNTS.categories ||
      franchises !== DEMO_SANDBOX_EXPECTED_COUNTS.franchises ||
      products !== DEMO_SANDBOX_EXPECTED_COUNTS.products ||
      users.length !== DEMO_SANDBOX_EXPECTED_COUNTS.users
    ) {
      return false;
    }

    if (users.some((user) => Number(user.idRole) === Number(Role.ADMIN))) {
      return false;
    }

    const expectedEmails = buildDemoSandboxSlotEmails(slotId);
    const isVerified = (value: unknown): boolean =>
      value instanceof Date && Number.isFinite(value.getTime());
    const hasBuyer = users.some(
      (user) =>
        Number(user.idRole) === Number(Role.USER) &&
        user.email === expectedEmails.buyer &&
        isVerified(user.emailVerifiedAt),
    );
    const hasStaff = users.some(
      (user) =>
        Number(user.idRole) === Number(Role.STAFF) &&
        user.email === expectedEmails.staff &&
        isVerified(user.emailVerifiedAt),
    );
    return hasBuyer && hasStaff;
  }
}
