import db from '../../database/models/db';
import { ScopedSequelizeUserRepository } from './ScopedSequelizeUserRepository';

export class SequelizeUserRepository extends ScopedSequelizeUserRepository {
  constructor() {
    super(db);
  }
}
