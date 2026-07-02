require('dotenv').config();

const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to initialize db.js');
}

const databaseUrl = new URL(connectionString);
const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const sql = postgres(connectionString, {
  prepare: databaseUrl.port === '6543' ? false : undefined,
  ssl: useSsl ? 'require' : undefined,
});

module.exports = sql;