const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

// Función para insertar datos iniciales en Category, Franchise, User y Product
async function seedInitialData(db) {
  // Categorías
  const categories = [
    { NameCategory: "Llavero" },
    { NameCategory: "Busto" },
    { NameCategory: "Figura" },
    { NameCategory: "Mascara" },
    { NameCategory: "Otras" },
  ];
  // Franquicias
  const franchises = [
    { NameFranchise: "Marvel" },
    { NameFranchise: "DC" },
    { NameFranchise: "Disney" },
    { NameFranchise: "Otra" },
  ];
  try {
    // Categorías
    const catCount = await db.Category.count();
    if (catCount === 0) {
      await db.Category.bulkCreate(categories);
      console.log("✔ Categorías insertadas");
    }
    // Franquicias
    const franqCount = await db.Franchise.count();
    if (franqCount === 0) {
      await db.Franchise.bulkCreate(franchises);
      console.log("✔ Franquicias insertadas");
    }
    // Usuarios
    const userCount = await db.User.count();
    if (userCount === 0) {
      const usersPath = path.join(__dirname, "data/users.json");
      if (fs.existsSync(usersPath)) {
        const usersData = JSON.parse(fs.readFileSync(usersPath, "utf8"));
        const usersHashed = usersData.map((u) => ({
          ...u,
          PasswordUser:
            u.PasswordUser && u.PasswordUser.startsWith("$2a$")
              ? u.PasswordUser
              : bcrypt.hashSync(u.PasswordUser || u.Password || u.password, 10),
        }));
        await db.User.bulkCreate(usersHashed);
        console.log(
          "✔ Usuarios insertados desde JSON (con contraseña hasheada)"
        );
      }
    }
    // Productos
    const prodCount = await db.Product.count();
    if (prodCount === 0) {
      const productsPath = path.join(__dirname, "data/products.json");
      if (fs.existsSync(productsPath)) {
        const productsData = JSON.parse(fs.readFileSync(productsPath, "utf8"));
        await db.Product.bulkCreate(productsData);
        console.log("✔ Productos insertados desde JSON");
      }
    }
  } catch (err) {
    console.error("Error al insertar datos iniciales:", err);
  }
}

module.exports = { seedInitialData };
