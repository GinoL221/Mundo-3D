const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

function resolveSeedDataPath(filename, baseDir = __dirname) {
  const localPath = path.join(baseDir, 'data', filename);
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  const sourceFallback = path.resolve(baseDir, '../../src/database/data', filename);
  if (fs.existsSync(sourceFallback)) {
    return sourceFallback;
  }
  return null;
}

const SEED_CATEGORIES = [
  { nameCategory: 'Llavero' },
  { nameCategory: 'Busto' },
  { nameCategory: 'Figura' },
  { nameCategory: 'Mascara' },
  { nameCategory: 'Otras' },
  { nameCategory: 'Lámpara' },
  { nameCategory: 'Accesorios' },
  { nameCategory: 'Terror/Fantasía' },
  { nameCategory: 'Utilitarios' },
  { nameCategory: 'Juguetes' },
  { nameCategory: 'Soportes y Setup' },
  { nameCategory: 'Macetas y Deco' },
  { nameCategory: 'Miniaturas y Rol' },
];

const SEED_FRANCHISES = [
  { nameFranchise: 'Marvel' },
  { nameFranchise: 'DC' },
  { nameFranchise: 'Disney' },
  { nameFranchise: 'Otra' },
  { nameFranchise: 'Zelda' },
  { nameFranchise: 'Star Wars' },
  { nameFranchise: 'Portal' },
  { nameFranchise: 'Pokemon' },
  { nameFranchise: 'Nintendo' },
  { nameFranchise: 'Terror/Fantasía' },
  { nameFranchise: 'Anime' },
  { nameFranchise: 'El Señor de los Anillos' },
  { nameFranchise: 'Gaming' },
  { nameFranchise: 'Diseño Original' },
];

// Función para insertar datos iniciales en Category, Franchise, User y Product
async function seedInitialData(db) {
  const categories = SEED_CATEGORIES;
  const franchises = SEED_FRANCHISES;
  try {
    // Categorías
    const catCount = await db.Category.count();
    if (catCount === 0) {
      await db.Category.bulkCreate(categories);
      console.log('✔ Categorías insertadas');
    }
    // Franquicias
    const franqCount = await db.Franchise.count();
    if (franqCount === 0) {
      await db.Franchise.bulkCreate(franchises);
      console.log('✔ Franquicias insertadas');
    }
    // Usuarios (never seed fixture accounts in production)
    if (process.env.NODE_ENV !== 'production') {
      const userCount = await db.User.count();
      if (userCount === 0) {
        const usersPath = resolveSeedDataPath('users.json');
        if (usersPath) {
          const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
          const usersHashed = usersData.map((u) => {
            const rawPassword = u.PasswordUser || u.Password || u.password || '';
            return {
              firstName: u.FirstName || u.firstName,
              lastName: u.LastName || u.lastName,
              email: u.Email || u.email,
              image: u.Image || u.image,
              passwordUser: rawPassword.startsWith('$2a$')
                ? rawPassword
                : bcrypt.hashSync(rawPassword, 10),
              idRole: u.IDRole || u.idRole,
              category: u.Category || u.category,
            };
          });
          await db.User.bulkCreate(usersHashed);
          console.log('✔ Usuarios insertados desde JSON (con contraseña hasheada)');
        }
      }
    }
    // Productos
    const prodCount = await db.Product.count();
    if (prodCount === 0) {
      const productsPath = resolveSeedDataPath('products.json');
      if (productsPath) {
        const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
        const productsMapped = productsData.map((p) => ({
          nameProduct: p.NameProduct || p.nameProduct,
          price: p.Price || p.price,
          descriptionProduct: p.DescriptionProduct || p.descriptionProduct,
          image: p.Image || p.image,
          idCategory: p.IDCategory || p.idCategory,
          idFranchise: p.IDFranchise || p.idFranchise,
          material: p.Material !== undefined ? p.Material : p.material,
          height: p.Height !== undefined ? p.Height : p.height,
          width: p.Width !== undefined ? p.Width : p.width,
          depth: p.Depth !== undefined ? p.Depth : p.depth,
          finish: p.Finish !== undefined ? p.Finish : p.finish,
          productionTime: p.ProductionTime !== undefined ? p.ProductionTime : p.productionTime,
          // Neither products.json nor this mapping ever set `stock` before
          // checkout could actually decrement it (orders-checkout) — every
          // seeded product silently got the model's `stock` column default
          // of 0, making the whole catalog unsellable out of the box. A
          // real per-product value belongs in products.json once inventory
          // has a real source of truth; a non-zero seed default until then.
          stock: p.Stock !== undefined ? p.Stock : (p.stock ?? 50),
        }));
        await db.Product.bulkCreate(productsMapped);
        console.log('✔ Productos insertados desde JSON');
      }
    }
  } catch (err) {
    console.error('Error al insertar datos iniciales:', err);
    throw err;
  }
}

function mapSeedProduct(p, idCategoryOverride, idFranchiseOverride) {
  return {
    nameProduct: p.NameProduct || p.nameProduct,
    price: p.Price || p.price,
    descriptionProduct: p.DescriptionProduct || p.descriptionProduct,
    image: p.Image || p.image,
    idCategory: idCategoryOverride ?? (p.IDCategory || p.idCategory),
    idFranchise: idFranchiseOverride ?? (p.IDFranchise || p.idFranchise),
    material: p.Material !== undefined ? p.Material : p.material,
    height: p.Height !== undefined ? p.Height : p.height,
    width: p.Width !== undefined ? p.Width : p.width,
    depth: p.Depth !== undefined ? p.Depth : p.depth,
    finish: p.Finish !== undefined ? p.Finish : p.finish,
    productionTime: p.ProductionTime !== undefined ? p.ProductionTime : p.productionTime,
    // Neither products.json nor this mapping ever set `stock` before
    // checkout could actually decrement it (orders-checkout) — every
    // seeded product silently got the Product model's `stock` column default
    // of 0, making the whole catalog unsellable out of the box. A
    // real per-product value belongs in products.json once inventory
    // has a real source of truth; a non-zero seed default until then.
    stock: p.Stock !== undefined ? p.Stock : (p.stock ?? 50),
  };
}

/**
 * Idempotently synchronizes seeded categories, franchises, and catalog products
 * into an already-populated database without deleting rows or breaking foreign
 * keys from existing orders/carts.
 */
async function syncCatalogData(db) {
  const productsPath = resolveSeedDataPath('products.json');
  if (!productsPath) {
    throw new Error('Catalog seed data file products.json not found');
  }
  const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

  const runSync = async (transaction) => {
    const txOpts = transaction ? { transaction } : {};
    const summary = {
      categoriesCreated: 0,
      franchisesCreated: 0,
      productsCreated: 0,
      productsUpdated: 0,
    };

    const existingCategories = await db.Category.findAll(txOpts);
    const categoryIdByName = new Map(
      existingCategories.map((row) => [row.nameCategory, Number(row.idCategory)]),
    );
    for (let index = 0; index < SEED_CATEGORIES.length; index += 1) {
      const { nameCategory } = SEED_CATEGORIES[index];
      if (!categoryIdByName.has(nameCategory)) {
        const expectedId = index + 1;
        const idTaken = existingCategories.some((row) => Number(row.idCategory) === expectedId);
        const created = await db.Category.create(
          idTaken ? { nameCategory } : { idCategory: expectedId, nameCategory },
          txOpts,
        );
        const createdId = Number(created.idCategory ?? expectedId);
        categoryIdByName.set(nameCategory, createdId);
        existingCategories.push({ idCategory: createdId, nameCategory });
        summary.categoriesCreated += 1;
      }
    }

    const existingFranchises = await db.Franchise.findAll(txOpts);
    const franchiseIdByName = new Map(
      existingFranchises.map((row) => [row.nameFranchise, Number(row.idFranchise)]),
    );
    for (let index = 0; index < SEED_FRANCHISES.length; index += 1) {
      const { nameFranchise } = SEED_FRANCHISES[index];
      if (!franchiseIdByName.has(nameFranchise)) {
        const expectedId = index + 1;
        const idTaken = existingFranchises.some((row) => Number(row.idFranchise) === expectedId);
        const created = await db.Franchise.create(
          idTaken ? { nameFranchise } : { idFranchise: expectedId, nameFranchise },
          txOpts,
        );
        const createdId = Number(created.idFranchise ?? expectedId);
        franchiseIdByName.set(nameFranchise, createdId);
        existingFranchises.push({ idFranchise: createdId, nameFranchise });
        summary.franchisesCreated += 1;
      }
    }

    for (const rawProduct of productsData) {
      const seedCategoryIndex = (rawProduct.IDCategory || rawProduct.idCategory) - 1;
      const seedFranchiseIndex = (rawProduct.IDFranchise || rawProduct.idFranchise) - 1;
      const categoryName = SEED_CATEGORIES[seedCategoryIndex]?.nameCategory;
      const franchiseName = SEED_FRANCHISES[seedFranchiseIndex]?.nameFranchise;
      const resolvedCategoryId = categoryName ? categoryIdByName.get(categoryName) : undefined;
      const resolvedFranchiseId = franchiseName ? franchiseIdByName.get(franchiseName) : undefined;

      const mapped = mapSeedProduct(rawProduct, resolvedCategoryId, resolvedFranchiseId);
      const existing = await db.Product.findOne({
        where: { nameProduct: mapped.nameProduct },
        ...txOpts,
      });

      if (existing) {
        const nextStock = Number(existing.stock ?? 0) > 0 ? Number(existing.stock) : mapped.stock;
        await existing.update({ ...mapped, stock: nextStock }, txOpts);
        summary.productsUpdated += 1;
      } else {
        await db.Product.create(mapped, txOpts);
        summary.productsCreated += 1;
      }
    }

    return summary;
  };

  if (db.sequelize && typeof db.sequelize.transaction === 'function') {
    return db.sequelize.transaction((transaction) => runSync(transaction));
  }
  return runSync(undefined);
}

module.exports = {
  seedInitialData,
  syncCatalogData,
  resolveSeedDataPath,
  SEED_CATEGORIES,
  SEED_FRANCHISES,
};
