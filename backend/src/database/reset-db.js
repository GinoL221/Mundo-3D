require('dotenv').config();
const { initializeModels } = require('./models');
const db = initializeModels();

async function reset() {
  try {
    console.log("Starting database tables reset...");
    await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    const [tables] = await db.sequelize.query("SHOW TABLES;");
    const dbName = db.sequelize.config.database;
    const key = `Tables_in_${dbName}`;
    
    for (const row of tables) {
      const tableName = row[key];
      console.log(`Dropping table: ${tableName}`);
      await db.sequelize.query(`DROP TABLE IF EXISTS \`${tableName}\`;`);
    }
    
    await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log("All tables dropped successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error resetting database:", err);
    process.exit(1);
  }
}

reset();
