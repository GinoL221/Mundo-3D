import db from '../../database/models/db';
import { ScopedSequelizeShoppingCartRepository } from './ScopedSequelizeShoppingCartRepository';

/** Legacy default-database composition; sandbox callers inject a slot-owned graph. */
export class SequelizeShoppingCartRepository extends ScopedSequelizeShoppingCartRepository {
  constructor() {
    super(db);
  }
}
