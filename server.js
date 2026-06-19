require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./models');
const config = require('./config/environment');

const PORT = config.app.port;

// Database connection and server startup
async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✓ Database connection successful');

    // Sync models (migrations should be run separately via CLI)
    // In production, use migrations: sequelize-cli db:migrate
    if (config.app.isDevelopment) {
      // Uncomment for development if not using migrations
      // await sequelize.sync({ alter: true });
      console.log('✓ Database models synced');
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║   Pimofy Digital - Server Started      ║
╠════════════════════════════════════════╣
║  Environment: ${config.app.nodeEnv.toUpperCase().padEnd(25, ' ')}║
║  URL: ${config.app.url.padEnd(32, ' ')}║
║  Port: ${PORT.toString().padEnd(30, ' ')}║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    const dbErrorCode = error?.original?.code || error?.parent?.code || 'UNKNOWN';
    const dbErrorName = error?.name || 'Error';
    const dbErrorMessage = error?.message || error?.original?.message || 'No error message provided';

    console.error(`✗ Failed to start server: [${dbErrorName}] ${dbErrorMessage}`);
    console.error(`  Database error code: ${dbErrorCode}`);
    if (config.app.isDevelopment && error?.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await sequelize.close();
  process.exit(0);
});

// Start the server
startServer();
