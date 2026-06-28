/* eslint-disable no-console */
// Force environment to 'test'
process.env.NODE_ENV = 'test';

const { ensureDatabaseExists } = require('./config/ensureDatabase');
const db = require('./models/db');
const { seedInitialData } = require('./seed');

async function prepare() {
  try {
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
    
    // 5. Close the sequelize connection
    await db.sequelize.close();
    console.log('Test database preparation complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error preparing test database:', err);
    process.exit(1);
  }
}

prepare();
