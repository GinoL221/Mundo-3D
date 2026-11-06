import db from '../../database/models/db';
import { ScopedSequelizeProductRepository } from './ScopedSequelizeProductRepository';

/** Legacy application composition; sandbox callers use explicit scoped persistence. */
export class SequelizeProductRepository extends ScopedSequelizeProductRepository {
  constructor() {
    super(db);
  }
}
