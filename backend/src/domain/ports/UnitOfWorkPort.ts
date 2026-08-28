// Opaque handle. Infrastructure knows it is a Sequelize Transaction; domain and
// application only pass it through. Typing it as `Transaction` would trip
// engine.js's `backend.domain.inward` external-import rule.
export interface TransactionContext {
  readonly __transactionBrand: unique symbol;
}

export interface UnitOfWorkPort {
  runInTransaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
