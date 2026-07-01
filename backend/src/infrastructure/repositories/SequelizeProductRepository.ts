import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';
import { Franchise } from '../../domain/entities/Franchise';
import { IProductRepository } from '../../domain/ports/IProductRepository';
import db, { ProductInstance, ProductAttributes } from '../../database/models/db';

export class SequelizeProductRepository implements IProductRepository {
  private toEntity(instance: ProductInstance): Product {
    const category = instance.Category
      ? new Category(instance.Category.idCategory, instance.Category.nameCategory)
      : undefined;

    const franchise = instance.Franchise
      ? new Franchise(instance.Franchise.idFranchise, instance.Franchise.nameFranchise)
      : undefined;

    return new Product(
      instance.idProduct,
      instance.nameProduct,
      Number(instance.price),
      instance.descriptionProduct,
      instance.image,
      instance.idCategory,
      instance.idFranchise,
      category,
      franchise,
      instance.material,
      instance.height !== null && instance.height !== undefined ? Number(instance.height) : null,
      instance.width !== null && instance.width !== undefined ? Number(instance.width) : null,
      instance.depth !== null && instance.depth !== undefined ? Number(instance.depth) : null,
      instance.finish,
      instance.productionTime !== null && instance.productionTime !== undefined ? Number(instance.productionTime) : null
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
      order: [['idProduct', 'DESC']],
    });
    if (!instance) return null;
    return this.toEntity(instance);
  }

  async create(product: Omit<Product, 'idProduct' | 'IDProduct' | 'NameProduct' | 'Price' | 'DescriptionProduct' | 'Image' | 'IDCategory' | 'IDFranchise' | 'Category' | 'Franchise' | 'Material' | 'Height' | 'Width' | 'Depth' | 'Finish' | 'ProductionTime'>): Promise<Product> {
    const instance = await db.Product.create({
      nameProduct: product.nameProduct,
      price: product.price,
      descriptionProduct: product.descriptionProduct,
      image: product.image,
      idCategory: product.idCategory,
      idFranchise: product.idFranchise,
      material: product.material,
      height: product.height,
      width: product.width,
      depth: product.depth,
      finish: product.finish,
      productionTime: product.productionTime,
    } as Partial<ProductAttributes>);

    const created = await this.findById(instance.idProduct);
    if (!created) {
      return new Product(
        instance.idProduct,
        instance.nameProduct,
        Number(instance.price),
        instance.descriptionProduct,
        instance.image,
        instance.idCategory,
        instance.idFranchise,
        undefined,
        undefined,
        instance.material,
        instance.height !== null && instance.height !== undefined ? Number(instance.height) : null,
        instance.width !== null && instance.width !== undefined ? Number(instance.width) : null,
        instance.depth !== null && instance.depth !== undefined ? Number(instance.depth) : null,
        instance.finish,
        instance.productionTime !== null && instance.productionTime !== undefined ? Number(instance.productionTime) : null
      );
    }
    return created;
  }

  async update(id: number, product: Partial<Product>): Promise<Product | null> {
    const instance = await db.Product.findByPk(id);
    if (!instance) return null;

    const updatedData: Partial<ProductInstance> = {};
    if (product.nameProduct !== undefined) updatedData.nameProduct = product.nameProduct;
    if (product.price !== undefined) updatedData.price = product.price;
    if (product.descriptionProduct !== undefined) updatedData.descriptionProduct = product.descriptionProduct;
    if (product.image !== undefined) updatedData.image = product.image;
    if (product.idCategory !== undefined) updatedData.idCategory = product.idCategory;
    if (product.idFranchise !== undefined) updatedData.idFranchise = product.idFranchise;
    if (product.material !== undefined) updatedData.material = product.material;
    if (product.height !== undefined) updatedData.height = product.height;
    if (product.width !== undefined) updatedData.width = product.width;
    if (product.depth !== undefined) updatedData.depth = product.depth;
    if (product.finish !== undefined) updatedData.finish = product.finish;
    if (product.productionTime !== undefined) updatedData.productionTime = product.productionTime;

    await instance.update(updatedData);

    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const deletedCount = await db.Product.destroy({
      where: { idProduct: id },
    });
    return deletedCount > 0;
  }
}
