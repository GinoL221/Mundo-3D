import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { Franchise } from '../../domain/entities/Franchise';
import { FranchiseRepositoryPort } from '../../domain/ports/FranchiseRepositoryPort';
import db, { FranchiseInstance, FranchiseAttributes } from '../../database/models/db';

const DUPLICATE_FRANCHISE_NAME = 'DUPLICATE_FRANCHISE_NAME';

export class SequelizeFranchiseRepository implements FranchiseRepositoryPort {
  private toEntity(instance: FranchiseInstance): Franchise {
    return new Franchise(instance.idFranchise, instance.nameFranchise);
  }

  async findAll(): Promise<Franchise[]> {
    const instances = await db.Franchise.findAll();
    return instances.map((inst) => this.toEntity(inst));
  }

  async findById(id: number): Promise<Franchise | null> {
    const instance = await db.Franchise.findByPk(id);
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async create(franchise: Omit<Franchise, 'idFranchise'>): Promise<Franchise> {
    try {
      const instance = await db.Franchise.create({
        nameFranchise: franchise.nameFranchise,
      } as Partial<FranchiseAttributes>);
      return this.toEntity(instance);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new Error(DUPLICATE_FRANCHISE_NAME, { cause: error });
      }
      throw error;
    }
  }

  async update(id: number, franchise: Partial<Franchise>): Promise<Franchise | null> {
    const instance = await db.Franchise.findByPk(id);
    if (!instance) return null;

    const updatedData: Partial<FranchiseInstance> = {};
    if (franchise.nameFranchise !== undefined) {
      updatedData.nameFranchise = franchise.nameFranchise;
    }

    try {
      await instance.update(updatedData);
      return this.toEntity(instance);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new Error(DUPLICATE_FRANCHISE_NAME, { cause: error });
      }
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const deletedCount = await db.Franchise.destroy({
        where: { idFranchise: id },
      });
      return deletedCount > 0;
    } catch (error) {
      if (error instanceof ForeignKeyConstraintError) {
        throw new Error('Franchise has associated products', { cause: error });
      }
      throw error;
    }
  }
}
