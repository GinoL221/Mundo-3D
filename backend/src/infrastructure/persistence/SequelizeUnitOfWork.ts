import db from '../../database/models/db';
import { ScopedSequelizeUnitOfWork } from './ScopedSequelizeUnitOfWork';

/** Legacy default composition; explicit callers use ScopedSequelizeUnitOfWork. */
export class SequelizeUnitOfWork extends ScopedSequelizeUnitOfWork {
  constructor() {
    super(db.sequelize);
  }
}
