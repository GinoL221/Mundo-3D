import type { EmailConfirmationTokenRepositoryPort } from '../../domain/ports/EmailConfirmationTokenRepositoryPort';
import { ScopedSequelizeEmailConfirmationTokenRepository } from '../repositories/ScopedSequelizeEmailConfirmationTokenRepository';
import type { UserRepositoryPort } from '../../domain/ports/UserRepositoryPort';
import { ScopedSequelizeUserRepository } from '../repositories/ScopedSequelizeUserRepository';
import type { CustomCommissionRequestRepositoryPort } from '../../domain/ports/CustomCommissionRequestRepositoryPort';
import { ScopedSequelizeCustomCommissionRequestRepository } from '../repositories/ScopedSequelizeCustomCommissionRequestRepository';
import { initializeModelsForConnection } from '../../database/models/registerModels';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import type { OrderRepositoryPort } from '../../domain/ports/OrderRepositoryPort';
import type { CategoryRepositoryPort } from '../../domain/ports/CategoryRepositoryPort';
import type { FranchiseRepositoryPort } from '../../domain/ports/FranchiseRepositoryPort';
import type { ShoppingCartRepositoryPort } from '../../domain/ports/ShoppingCartRepositoryPort';
import type { UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';
import { ScopedSequelizeUnitOfWork } from '../persistence/ScopedSequelizeUnitOfWork';
import { ScopedSequelizeProductRepository } from '../repositories/ScopedSequelizeProductRepository';
import { ScopedSequelizeCategoryRepository } from '../repositories/ScopedSequelizeCategoryRepository';
import { ScopedSequelizeFranchiseRepository } from '../repositories/ScopedSequelizeFranchiseRepository';
import { ScopedSequelizeShoppingCartRepository } from '../repositories/ScopedSequelizeShoppingCartRepository';
import { ScopedSequelizeOrderRepository } from '../repositories/ScopedSequelizeOrderRepository';
import { DemoSandboxConnections } from './DemoSandboxConnections';

export interface DemoSandboxProductRepositories {
  getEmailConfirmationTokenRepository(slotId: string): EmailConfirmationTokenRepositoryPort;
  getUserRepository(slotId: string): UserRepositoryPort;
  getCustomCommissionRequestRepository(slotId: string): CustomCommissionRequestRepositoryPort;
  get(slotId: string): ProductRepositoryPort;
  getCategoryRepository(slotId: string): CategoryRepositoryPort;
  getFranchiseRepository(slotId: string): FranchiseRepositoryPort;
  getShoppingCartRepository(slotId: string): ShoppingCartRepositoryPort;
  getOrderRepository(slotId: string): OrderRepositoryPort;
  getUnitOfWork(slotId: string): UnitOfWorkPort;
}

/** Internal composition only; does not authorize a lease or expose request routing. */
export function createDemoSandboxProductRepositories(
  connections: DemoSandboxConnections,
): DemoSandboxProductRepositories {
  const repositories = new Map<string, ProductRepositoryPort>();
  const categories = new Map<string, CategoryRepositoryPort>();
  const franchises = new Map<string, FranchiseRepositoryPort>();
  const shoppingCarts = new Map<string, ShoppingCartRepositoryPort>();
  const commissions = new Map<string, CustomCommissionRequestRepositoryPort>();
  const emailTokens = new Map<string, EmailConfirmationTokenRepositoryPort>();
  const users = new Map<string, UserRepositoryPort>();
  const orders = new Map<string, OrderRepositoryPort>();
  const unitsOfWork = new Map<string, UnitOfWorkPort>();
  const graphs = new Map<string, ReturnType<typeof initializeModelsForConnection>>();
  function getModels(slotId: string): ReturnType<typeof initializeModelsForConnection> {
    const existing = graphs.get(slotId);
    if (existing) return existing;
    const models = initializeModelsForConnection(connections.get(slotId));
    graphs.set(slotId, models);
    return models;
  }
  return {
    getEmailConfirmationTokenRepository(slotId) {
      const existing = emailTokens.get(slotId);
      if (existing) return existing;
      const repository = new ScopedSequelizeEmailConfirmationTokenRepository(getModels(slotId));
      emailTokens.set(slotId, repository);
      return repository;
    },
    getUserRepository(slotId) {
      const existing = users.get(slotId);
      if (existing) return existing;
      const repository = new ScopedSequelizeUserRepository(getModels(slotId));
      users.set(slotId, repository);
      return repository;
    },
    getCustomCommissionRequestRepository(slotId) {
      const existing = commissions.get(slotId);
      if (existing) return existing;
      const repository = new ScopedSequelizeCustomCommissionRequestRepository(getModels(slotId));
      commissions.set(slotId, repository);
      return repository;
    },
    getFranchiseRepository(slotId) {
      const existing = franchises.get(slotId);
      if (existing) return existing;
      const repository = new ScopedSequelizeFranchiseRepository(getModels(slotId));
      franchises.set(slotId, repository);
      return repository;
    },
    getCategoryRepository(slotId) {
      const existing = categories.get(slotId);
      if (existing) return existing;
      const repository = new ScopedSequelizeCategoryRepository(getModels(slotId));
      categories.set(slotId, repository);
      return repository;
    },
    getShoppingCartRepository(slotId) {
      const existing = shoppingCarts.get(slotId);
      if (existing) return existing;
      const repository = new ScopedSequelizeShoppingCartRepository(getModels(slotId));
      shoppingCarts.set(slotId, repository);
      return repository;
    },
    getOrderRepository(slotId) {
      const existing = orders.get(slotId);
      if (existing) return existing;
      const repository = new ScopedSequelizeOrderRepository(getModels(slotId));
      orders.set(slotId, repository);
      return repository;
    },
    getUnitOfWork(slotId) {
      const existing = unitsOfWork.get(slotId);
      if (existing) return existing;
      const unitOfWork = new ScopedSequelizeUnitOfWork(connections.get(slotId));
      unitsOfWork.set(slotId, unitOfWork);
      return unitOfWork;
    },
    get(slotId) {
      const existing = repositories.get(slotId);
      if (existing) return existing;
      const repository = new ScopedSequelizeProductRepository(getModels(slotId));
      repositories.set(slotId, repository);
      return repository;
    },
  };
}
