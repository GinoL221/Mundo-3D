import { ForeignKeyConstraintError } from 'sequelize';
import { Franchise } from '../../domain/entities/Franchise';
import { IFranchiseRepository } from '../../domain/ports/IFranchiseRepository';
import db, { FranchiseInstance, FranchiseAttributes } from '../../database/models/db';

export class SequelizeFranchiseRepository implements IFranchiseRepository {
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
    const instance = await db.Franchise.create({
      nameFranchise: franchise.nameFranchise,
    } as Partial<FranchiseAttributes>);
    return this.toEntity(instance);
  }

  async update(id: number, franchise: Partial<Franchise>): Promise<Franchise | null> {
    const instance = await db.Franchise.findByPk(id);
    if (!instance) return null;

    const updatedData: Partial<FranchiseInstance> = {};
    if (franchise.nameFranchise !== undefined) {
      updatedData.nameFranchise = franchise.nameFranchise;
    }

    await instance.update(updatedData);
    return this.toEntity(instance);
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
