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
  ];
  // Franquicias
  const franchises = [
    { nameFranchise: 'Marvel' },
    { nameFranchise: 'DC' },
    { nameFranchise: 'Disney' },
    { nameFranchise: 'Otra' },
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
          NameProduct: p.NameProduct,
          Price: p.Price,
          DescriptionProduct: p.DescriptionProduct,
          Image: p.Image,
          idCategory: p.IDCategory || p.idCategory,
          idFranchise: p.IDFranchise || p.idFranchise,
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
