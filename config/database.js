require('dotenv').config();

const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';
const ipFamily = Number(process.env.DB_IP_FAMILY || 0);
const isVercel = String(process.env.VERCEL || '').toLowerCase() === '1'
  || String(process.env.VERCEL || '').toLowerCase() === 'true';
const poolMode = String(process.env.DB_POOL_MODE || (isVercel ? 'transaction' : 'session')).toLowerCase();
const parsedPoolMax = Number(process.env.DB_POOL_MAX);
const parsedPoolMin = Number(process.env.DB_POOL_MIN);
const parsedPoolAcquire = Number(process.env.DB_POOL_ACQUIRE_MS);
const parsedPoolIdle = Number(process.env.DB_POOL_IDLE_MS);

function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl || poolMode !== 'transaction') {
    return rawUrl;
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const isSupabasePooler = parsedUrl.hostname.endsWith('.pooler.supabase.com');

    if (!isSupabasePooler) {
      return rawUrl;
    }

    // Supabase transaction pooler listens on 6543 while session mode uses 5432.
    if (!parsedUrl.port || parsedUrl.port === '5432') {
      parsedUrl.port = '6543';
    }

    return parsedUrl.toString();
  } catch (error) {
    return rawUrl;
  }
}

const resolvedDatabaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);

const poolConfig = {
  // Keep pool small by default in serverless runtimes to avoid exhausting shared DB connections.
  max: Number.isFinite(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : (isVercel ? 1 : 5),
  min: Number.isFinite(parsedPoolMin) && parsedPoolMin >= 0 ? parsedPoolMin : 0,
  acquire: Number.isFinite(parsedPoolAcquire) && parsedPoolAcquire > 0 ? parsedPoolAcquire : 30000,
  idle: Number.isFinite(parsedPoolIdle) && parsedPoolIdle > 0 ? parsedPoolIdle : 10000,
};

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
  pool: poolConfig,
};

if (resolvedDatabaseUrl) {
  const config = {
    development: {
      ...baseConfig,
      url: resolvedDatabaseUrl,
      dialectOptions: buildDialectOptions(false),
    },
    test: {
      ...baseConfig,
      logging: false,
      url: resolvedDatabaseUrl,
      dialectOptions: buildDialectOptions(false),
    },
    production: {
      ...baseConfig,
      logging: false,
      url: resolvedDatabaseUrl,
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
