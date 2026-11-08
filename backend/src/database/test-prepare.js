const { readE2EDatabaseContext } = require('./e2e/context');

async function prepare() {
  try {
    // Reject before loading models, opening a connection, or emitting success
    // output. Real endpoint verification also runs on the DDL connection and
    // every Sequelize physical connection, including replacements.
    readE2EDatabaseContext(process.env, { required: true });
    const bcrypt = require('bcryptjs');
    const { ensureDatabaseExists } = require('./config/ensureDatabase');
    const db = require('./models/db');
    const { seedInitialData } = require('./seed');
    console.log('Preparing test database...');
    // 1. Ensure test database exists
    await ensureDatabaseExists('test');
    
    // 2. Force sync the models
    await db.sequelize.sync({ force: true });
    console.log('✔ Database schema recreated successfully.');
    
    // 3. Seed the initial data
    await seedInitialData(db);
    
    // 4. Ensure there is a second product for E2E cart tests
    const count = await db.Product.count();
    if (count < 2) {
      await db.Product.create({
        nameProduct: 'Luigi',
        price: 1600.00,
        descriptionProduct: 'Hermano de Mario',
        image: 'Luigi.jpg',
        idCategory: 1,
        idFranchise: 4
      });
      console.log('✔ Second product (Luigi) seeded for E2E tests.');
    }

    // 4b. Ensure a STAFF fixture user exists for E2E role-gating tests.
    // idRole: 3 mirrors Role.STAFF as defined in backend/src/domain/Role.ts
    // and frontend/src/domains/auth/adapters/auth.adapter.ts — if either of
    // those mirrors ever changes the STAFF value, update it here too.
    const existingStaff = await db.User.findOne({ where: { email: 'staff@email.com' } });
    if (!existingStaff) {
      await db.User.create({
        firstName: 'Staff',
        lastName: 'User',
        email: 'staff@email.com',
        image: 'usuarioSinImagen.jpg',
        passwordUser: bcrypt.hashSync('staff123', 10),
        idRole: 3,
        category: 'Staff',
      });
      console.log('✔ STAFF fixture user (staff@email.com) seeded for E2E tests.');
    }

    // 5. Close the sequelize connection
    await db.sequelize.close();
    console.log('Test database preparation complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error preparing test database:', err.message);
    process.exit(1);
  }
}

if (require.main === module) prepare();

module.exports = { prepare };
