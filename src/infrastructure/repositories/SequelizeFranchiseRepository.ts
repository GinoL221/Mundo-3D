import { Franchise } from '../../domain/entities/Franchise';
import { IFranchiseRepository } from '../../domain/ports/IFranchiseRepository';
import db, { FranchiseInstance } from '../../database/models/db';

export class SequelizeFranchiseRepository implements IFranchiseRepository {
  private toEntity(instance: FranchiseInstance): Franchise {
    return new Franchise(instance.IDFranchise, instance.NameFranchise);
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

  async create(franchise: Omit<Franchise, 'IDFranchise'>): Promise<Franchise> {
    const instance = await db.Franchise.create({
      NameFranchise: franchise.NameFranchise,
    } as any);
    return this.toEntity(instance);
  }

  async update(id: number, franchise: Partial<Franchise>): Promise<Franchise | null> {
    const instance = await db.Franchise.findByPk(id);
    if (!instance) return null;

    const updatedData: Partial<FranchiseInstance> = {};
    if (franchise.NameFranchise !== undefined) {
      updatedData.NameFranchise = franchise.NameFranchise;
    }

    await instance.update(updatedData);
    return this.toEntity(instance);
  }

  async delete(id: number): Promise<boolean> {
    const deletedCount = await db.Franchise.destroy({
      where: { IDFranchise: id },
    });
    return deletedCount > 0;
  }
}
