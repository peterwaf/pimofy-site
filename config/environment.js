require('dotenv').config();

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

// Validate required environment variables
const requiredDbEnvVars = hasDatabaseUrl
  ? ['DATABASE_URL']
  : ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

const requiredEnvVars = [
  ...requiredDbEnvVars,
  'SESSION_SECRET',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please set the required values in your local .env file.');
  process.exit(1);
}

// Environment configuration
module.exports = {
  database: {
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: process.env.DB_DIALECT || 'postgres',
  },
  session: {
    secret: process.env.SESSION_SECRET,
  },
  superAdmin: {
    name: process.env.SUPER_ADMIN_NAME,
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
  },
  app: {
    url: process.env.APP_URL || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    contactEmail: process.env.CONTACT_EMAIL,
    adminEmail: process.env.ADMIN_EMAIL,
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880, // 5MB default
    uploadDir: process.env.UPLOAD_DIR || 'public/uploads',
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp').split(','),
  },
  seo: {
    siteName: process.env.SITE_NAME || 'Pimofy Digital',
    siteDescription: process.env.SITE_DESCRIPTION || 'Dedicated data operations for SaaS and Ecommerce companies',
    siteKeywords: process.env.SITE_KEYWORDS || 'data operations, bpo, saas, ecommerce',
  },
};
