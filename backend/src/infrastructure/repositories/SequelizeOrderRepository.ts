import db from '../../database/models/db';
import { ScopedSequelizeOrderRepository } from './ScopedSequelizeOrderRepository';

/** Legacy default-database composition; sandbox callers inject a slot-owned graph. */
export class SequelizeOrderRepository extends ScopedSequelizeOrderRepository {
  constructor() {
    super(db);
  }
}
