require('dotenv').config();

const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';
const ipFamily = Number(process.env.DB_IP_FAMILY || 0);
const isVercel = String(process.env.VERCEL || '').toLowerCase() === '1'
  || String(process.env.VERCEL || '').toLowerCase() === 'true';

const buildDialectOptions = (forceSsl = false) => {
  const options = {};

  if (useSsl || forceSsl) {
    options.ssl = {
      require: true,
      rejectUnauthorized,
    };
  }

  if (ipFamily === 4 || ipFamily === 6) {
    // Some serverless runtimes can fail when IPv6 is forced; prefer IPv4 there.
    options.family = isVercel && ipFamily === 6 ? 4 : ipFamily;
  }

  return options;
};

const baseConfig = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'production' ? false : console.log,
};

if (process.env.DATABASE_URL) {
  const config = {
    development: {
      ...baseConfig,
      url: process.env.DATABASE_URL,
      dialectOptions: buildDialectOptions(false),
    },
    test: {
      ...baseConfig,
      logging: false,
      url: process.env.DATABASE_URL,
      dialectOptions: buildDialectOptions(false),
    },
    production: {
      ...baseConfig,
      logging: false,
      url: process.env.DATABASE_URL,
      dialectOptions: buildDialectOptions(true),
    },
  };

  module.exports = config;
  return;
}

const config = {
  development: {
    ...baseConfig,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'pimofy_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialectOptions: buildDialectOptions(false),
  },
  test: {
    ...baseConfig,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'pimofy_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    logging: false,
    dialectOptions: buildDialectOptions(false),
  },
  production: {
    ...baseConfig,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    logging: false,
    dialectOptions: buildDialectOptions(true),
  },
};

module.exports = config;
