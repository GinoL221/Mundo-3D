import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';
import { Franchise } from '../../domain/entities/Franchise';
import { IProductRepository } from '../../domain/ports/IProductRepository';
import db, { ProductInstance } from '../../database/models/db';

export class SequelizeProductRepository implements IProductRepository {
  private toEntity(instance: ProductInstance): Product {
    const category = instance.Category
      ? new Category(instance.Category.IDCategory, instance.Category.NameCategory)
      : undefined;

    const franchise = instance.Franchise
      ? new Franchise(instance.Franchise.IDFranchise, instance.Franchise.NameFranchise)
      : undefined;

    return new Product(
      instance.IDProduct,
      instance.NameProduct,
      Number(instance.Price),
      instance.DescriptionProduct,
      instance.Image,
      instance.IDCategory,
      instance.IDFranchise,
      category,
      franchise
    );
  }

  async findAll(): Promise<Product[]> {
    const instances = await db.Product.findAll({
      include: [
        {
          model: db.Category,
          as: 'Category',
          attributes: ['IDCategory', 'NameCategory'],
        },
        {
          model: db.Franchise,
          as: 'Franchise',
          attributes: ['IDFranchise', 'NameFranchise'],
        },
      ],
    });
    return instances.map((inst) => this.toEntity(inst));
  }

  async findById(id: number): Promise<Product | null> {
    const instance = await db.Product.findByPk(id, {
      include: [
        {
          model: db.Category,
          as: 'Category',
          attributes: ['IDCategory', 'NameCategory'],
        },
        {
          model: db.Franchise,
          as: 'Franchise',
          attributes: ['IDFranchise', 'NameFranchise'],
        },
      ],
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async findLatest(): Promise<Product | null> {
    const instance = await db.Product.findOne({
      include: [
        {
          model: db.Category,
          as: 'Category',
          attributes: ['IDCategory', 'NameCategory'],
        },
        {
          model: db.Franchise,
          as: 'Franchise',
          attributes: ['IDFranchise', 'NameFranchise'],
        },
      ],
      order: [['IDProduct', 'DESC']],
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async create(product: Omit<Product, 'IDProduct' | 'Category' | 'Franchise'>): Promise<Product> {
    const instance = await db.Product.create({
      NameProduct: product.NameProduct,
      Price: product.Price,
      DescriptionProduct: product.DescriptionProduct,
      Image: product.Image,
      IDCategory: product.IDCategory,
      IDFranchise: product.IDFranchise,
    } as any);

    const created = await this.findById(instance.IDProduct);
    if (!created) {
      return new Product(
        instance.IDProduct,
        instance.NameProduct,
        Number(instance.Price),
        instance.DescriptionProduct,
        instance.Image,
        instance.IDCategory,
        instance.IDFranchise
      );
    }
    return created;
  }

  async update(id: number, product: Partial<Product>): Promise<Product | null> {
    const instance = await db.Product.findByPk(id);
    if (!instance) return null;

    const updatedData: Partial<ProductInstance> = {};
    if (product.NameProduct !== undefined) updatedData.NameProduct = product.NameProduct;
    if (product.Price !== undefined) updatedData.Price = product.Price;
    if (product.DescriptionProduct !== undefined) updatedData.DescriptionProduct = product.DescriptionProduct;
    if (product.Image !== undefined) updatedData.Image = product.Image;
    if (product.IDCategory !== undefined) updatedData.IDCategory = product.IDCategory;
    if (product.IDFranchise !== undefined) updatedData.IDFranchise = product.IDFranchise;

    await instance.update(updatedData);

    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const deletedCount = await db.Product.destroy({
      where: { IDProduct: id },
    });
    return deletedCount > 0;
  }
}
