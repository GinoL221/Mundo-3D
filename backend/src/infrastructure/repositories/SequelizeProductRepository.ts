import { QueryTypes } from 'sequelize';
import { Product } from '../../domain/entities/Product';
import { Category } from '../../domain/entities/Category';
import { Franchise } from '../../domain/entities/Franchise';
import { ProductRepositoryPort } from '../../domain/ports/ProductRepositoryPort';
import db, { ProductInstance, ProductAttributes } from '../../database/models/db';

// Raw column names as defined in `database/models/Product.js` (field mappings).
// Kept in sync manually with that model definition — update both if either changes.
const PRODUCT_TABLE = '`Product`';
const PRODUCT_ID_COLUMN = '`id_product`';
const PRODUCT_STOCK_COLUMN = '`stock`';

export class SequelizeProductRepository implements ProductRepositoryPort {
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
      instance.productionTime !== null && instance.productionTime !== undefined ? Number(instance.productionTime) : null,
      instance.stock !== null && instance.stock !== undefined ? Number(instance.stock) : null
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

  async create(product: Omit<Product, 'idProduct' | 'IDProduct' | 'NameProduct' | 'Price' | 'DescriptionProduct' | 'Image' | 'IDCategory' | 'IDFranchise' | 'Category' | 'Franchise' | 'Material' | 'Height' | 'Width' | 'Depth' | 'Finish' | 'ProductionTime' | 'Stock'>): Promise<Product> {
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
      stock: product.stock,
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
        instance.productionTime !== null && instance.productionTime !== undefined ? Number(instance.productionTime) : null,
        instance.stock !== null && instance.stock !== undefined ? Number(instance.stock) : null
      );
    }
    return created;
  }

  // NOTE: `stock` is intentionally NOT accepted here — see ProductRepositoryPort's
  // `Omit<Partial<Product>, 'stock'>` signature. Per product-inventory spec
  // ("Product Update"), PUT /api/products/:id MUST NOT modify stock; stock is
  // exclusively mutated via `adjustStock` (PATCH .../stock).
  async update(id: number, product: Omit<Partial<Product>, 'stock'>): Promise<Product | null> {
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

  // Atomic, race-safe stock adjustment. Implemented as a single conditional
  // `UPDATE ... SET stock = stock + :delta WHERE id = :id AND stock + :delta >= 0`
  // instead of a JS-level read-then-write, so two concurrent calls can never both
  // pass a negative-stock check and then overwrite each other's write (TOCTOU/lost
  // update). Sequelize's `sequelize.query(sql, { type: QueryTypes.UPDATE })` on the
  // MySQL dialect used by this project resolves to `[undefined, affectedRowCount]`,
  // giving us a reliable affected-row count to distinguish "not found" from
  // "floor condition failed" without a second read-then-write race window.
  async adjustStock(id: number, delta: number): Promise<Product | null> {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new Error('Delta must be a non-zero integer');
    }

    const [, affectedRows] = await db.sequelize.query(
      `UPDATE ${PRODUCT_TABLE} SET ${PRODUCT_STOCK_COLUMN} = ${PRODUCT_STOCK_COLUMN} + :delta ` +
        `WHERE ${PRODUCT_ID_COLUMN} = :id AND ${PRODUCT_STOCK_COLUMN} + :delta >= 0`,
      {
        replacements: { id, delta },
        type: QueryTypes.UPDATE,
      }
    );

    if (affectedRows === 0) {
      const existing = await db.Product.findByPk(id);
      if (!existing) return null;
      throw new Error('Insufficient stock');
    }

    return this.findById(id);
  }
}
