import db from '../../database/models/db';
import { ScopedSequelizeFranchiseRepository } from './ScopedSequelizeFranchiseRepository';

/** Legacy composition: existing callers retain the default model graph. */
export class SequelizeFranchiseRepository extends ScopedSequelizeFranchiseRepository {
  constructor() {
    super(db);
  }
}
