import db from '../../database/models/db';
import { ScopedSequelizeCategoryRepository } from './ScopedSequelizeCategoryRepository';

/** Legacy composition: existing callers retain the default model graph. */
export class SequelizeCategoryRepository extends ScopedSequelizeCategoryRepository {
  constructor() {
    super(db);
  }
}
