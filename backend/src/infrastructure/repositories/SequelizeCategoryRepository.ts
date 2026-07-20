import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { Category } from '../../domain/entities/Category';
import { ICategoryRepository } from '../../domain/ports/ICategoryRepository';
import db, { CategoryInstance, CategoryAttributes } from '../../database/models/db';

const DUPLICATE_CATEGORY_NAME = 'DUPLICATE_CATEGORY_NAME';

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
    try {
      const instance = await db.Category.create({
        nameCategory: category.nameCategory,
      } as Partial<CategoryAttributes>);
      return this.toEntity(instance);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new Error(DUPLICATE_CATEGORY_NAME, { cause: error });
      }
      throw error;
    }
  }

  async update(id: number, category: Partial<Category>): Promise<Category | null> {
    const instance = await db.Category.findByPk(id);
    if (!instance) return null;

    const updatedData: Partial<CategoryInstance> = {};
    if (category.nameCategory !== undefined) {
      updatedData.nameCategory = category.nameCategory;
    }

    try {
      await instance.update(updatedData);
      return this.toEntity(instance);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new Error(DUPLICATE_CATEGORY_NAME, { cause: error });
      }
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      const deletedCount = await db.Category.destroy({
        where: { idCategory: id },
      });
      return deletedCount > 0;
    } catch (error) {
      if (error instanceof ForeignKeyConstraintError) {
        throw new Error('Category has associated products', { cause: error });
      }
      throw error;
    }
  }
}
