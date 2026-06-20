import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';
import { Franchise } from '../../domain/entities/Franchise';
import { IProductRepository } from '../../domain/ports/IProductRepository';
import db, { ProductInstance } from '../../database/models/db';

export class SequelizeProductRepository implements IProductRepository {
  private toEntity(instance: ProductInstance): Product {
    const category = instance.Category
      ? new Category(instance.Category.idCategory, instance.Category.nameCategory)
      : undefined;

    const franchise = instance.Franchise
      ? new Franchise(instance.Franchise.idFranchise, instance.Franchise.nameFranchise)
      : undefined;

    return new Product(
      instance.IDProduct,
      instance.NameProduct,
      Number(instance.Price),
      instance.DescriptionProduct,
      instance.Image,
      instance.idCategory,
      instance.idFranchise,
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
          attributes: ['idCategory', 'nameCategory'],
        },
        {
          model: db.Franchise,
          as: 'Franchise',
          attributes: ['idFranchise', 'nameFranchise'],
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
          attributes: ['idCategory', 'nameCategory'],
        },
        {
          model: db.Franchise,
          as: 'Franchise',
          attributes: ['idFranchise', 'nameFranchise'],
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
          attributes: ['idCategory', 'nameCategory'],
        },
        {
          model: db.Franchise,
          as: 'Franchise',
          attributes: ['idFranchise', 'nameFranchise'],
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
      idCategory: product.idCategory,
      idFranchise: product.idFranchise,
    } as any);

    const created = await this.findById(instance.IDProduct);
    if (!created) {
      return new Product(
        instance.IDProduct,
        instance.NameProduct,
        Number(instance.Price),
        instance.DescriptionProduct,
        instance.Image,
        instance.idCategory,
        instance.idFranchise
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
    if (product.idCategory !== undefined) updatedData.idCategory = product.idCategory;
    if (product.idFranchise !== undefined) updatedData.idFranchise = product.idFranchise;

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
