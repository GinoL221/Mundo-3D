import { Franchise } from '../entities/Franchise';

export interface IFranchiseRepository {
  findAll(): Promise<Franchise[]>;
  findById(id: number): Promise<Franchise | null>;
  create(franchise: Omit<Franchise, 'idFranchise'>): Promise<Franchise>;
  update(id: number, franchise: Partial<Franchise>): Promise<Franchise | null>;
  delete(id: number): Promise<boolean>;
}
