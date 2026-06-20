import { Category } from '../../domain/entities/Category';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import db, { CategoryInstance } from '../../database/models/db';

export class SequelizeCategoryRepository implements ICategoryRepository {
  private toEntity(instance: CategoryInstance): Category {
    return new Category(instance.idCategory, instance.nameCategory);
  }

  async findAll(): Promise<Category[]> {
    const instances = await db.Category.findAll();
    return instances.map((inst) => this.toEntity(inst));
  }

  async findById(id: number): Promise<Category | null> {
    const instance = await db.Category.findByPk(id);
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async create(category: Omit<Category, 'idCategory'>): Promise<Category> {
    const instance = await db.Category.create({
      nameCategory: category.nameCategory,
    } as any);
    return this.toEntity(instance);
  }

  async update(id: number, category: Partial<Category>): Promise<Category | null> {
    const instance = await db.Category.findByPk(id);
    if (!instance) return null;

    const updatedData: Partial<CategoryInstance> = {};
    if (category.nameCategory !== undefined) {
      updatedData.nameCategory = category.nameCategory;
    }

    await instance.update(updatedData);
    return this.toEntity(instance);
  }

  async delete(id: number): Promise<boolean> {
    const deletedCount = await db.Category.destroy({
      where: { idCategory: id },
    });
    return deletedCount > 0;
  }
}
