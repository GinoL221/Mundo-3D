import db from '../../database/models/db';
import { ScopedSequelizeCustomCommissionRequestRepository } from './ScopedSequelizeCustomCommissionRequestRepository';

export class SequelizeCustomCommissionRequestRepository extends ScopedSequelizeCustomCommissionRequestRepository {
  constructor() {
    super(db);
  }
}
