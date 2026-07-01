const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Función para insertar datos iniciales en Category, Franchise, User y Product
async function seedInitialData(db) {
  // Categorías
  const categories = [
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
  ];
  // Franquicias
  const franchises = [
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
  ];
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
    // Usuarios
    const userCount = await db.User.count();
    if (userCount === 0) {
      const usersPath = path.join(__dirname, 'data/users.json');
      if (fs.existsSync(usersPath)) {
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
    // Productos
    const prodCount = await db.Product.count();
    if (prodCount === 0) {
      const productsPath = path.join(__dirname, 'data/products.json');
      if (fs.existsSync(productsPath)) {
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
        }));
        await db.Product.bulkCreate(productsMapped);
        console.log('✔ Productos insertados desde JSON');
      }
    }
  } catch (err) {
    console.error('Error al insertar datos iniciales:', err);
  }
}

module.exports = { seedInitialData };
