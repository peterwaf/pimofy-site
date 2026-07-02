# Pimofy Site

Pimofy Site is a Node.js and Express application for the Pimofy Digital marketing site and admin workspace.

## Stack

- Node.js and Express
- EJS views with a shared layout system
- Sequelize + PostgreSQL
- Session storage backed by Sequelize
- Helmet, rate limiting, CSRF protection, and validation middleware
- Multer for image uploads

## Project Structure

```text
app.js              # Express app bootstrap, middleware, routes
server.js           # Server start, DB/session sync
config/              # Environment and database config
controllers/         # Request handlers
middleware/          # Auth, validation, CSRF helpers
migrations/          # Sequelize migrations
models/              # Sequelize models and associations
routes/              # Public and admin routes
seeders/             # Initial admin/content seed data
views/               # EJS templates
public/              # Static assets, uploads, admin JS
styles.css           # Shared front-end stylesheet
script.js            # Public site interactions
```

## Requirements

- Node.js 18+ recommended
- PostgreSQL
- SMTP access for the contact form

## Setup

1. Install dependencies:

```bash
npm install
```

2. Open your local `.env` file and fill in the values needed for your environment.

3. Keep sensitive local configuration out of this README. Use the private setup notes in `docs/local-setup-private.md` for the full list of required values.

4. Run migrations and seed the initial data:

```bash
npm run db:migrate
npm run db:seed
```

5. Start the application:

```bash
npm start
```

For development:

```bash
npm run dev
```

## Environment Variables

Required local values are documented in the private setup notes at `docs/local-setup-private.md`.

Keep `.env` private and do not commit it to version control.

## Scripts

- `npm start` - start the server
- `npm run dev` - start with nodemon
- `npm run db:migrate` - run Sequelize migrations
- `npm run db:seed` - seed content and the initial super admin
- `npm run db:reset` - drop, recreate, migrate, and seed the database

## Security Notes

- CSRF tokens are required on mutating forms and admin actions.
- Sessions are stored in PostgreSQL through Sequelize.
- Helmet, rate limiting, and input validation are enabled.
- Article HTML is sanitized before storage to reduce XSS risk.
- Logout uses POST instead of GET.

## Production Checklist

- Set `NODE_ENV=production`.
- Use a strong `SESSION_SECRET`.
- Configure production database and SMTP credentials.
- Set `APP_URL` to the public site URL.
- Serve the app behind HTTPS.
- Confirm migrations and seed data ran successfully.
- Verify the admin account password is changed from the initial seed value.

## Deploy on Vercel

This project is an Express server rendered through a Vercel Serverless Function.

### 1. Vercel adapter files

These files are already included:

- `vercel.json`
- `api/index.js`

### 2. Connect your repository

1. In Vercel, choose **Add New...** -> **Project**.
2. Select this repository and branch.
3. Framework preset: **Other**.
4. Build command: leave empty.
5. Output directory: leave empty.

### 3. Configure environment variables

In Vercel Project Settings -> Environment Variables, add all required values from your local `.env`.

At minimum, configure:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (optional, defaults to `media`)
- `SUPABASE_MEDIA_FOLDER` (optional, defaults to `blog-posts`)
- `SESSION_SECRET`
- `SUPER_ADMIN_NAME`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `CONTACT_EMAIL`
- `ADMIN_EMAIL`
- `APP_URL` (set to your Vercel production URL)
- `NODE_ENV=production`

Optional for network compatibility:

- `DB_IP_FAMILY=4`

### 4. Apply database migrations

Run these commands against your production database before first traffic:

```bash
npm run db:migrate
npm run db:seed
```

### 5. Validate deployment

After deploy, verify:

- Public pages load.
- Admin login works.
- Contact form works.
- Admin create/update/delete flows succeed.

### 6. Upload and taxonomy caveat

Vercel Serverless Functions use ephemeral filesystem storage. Local uploads under `public/uploads` are not durable in production.

For reliable production media handling, use object storage (for example Supabase Storage) and persist public URLs in the database.

Taxonomy reads from `config/taxonomy.json` are supported in the deployed bundle, but file writes are not durable across serverless instances.

## Notes

- Static uploads are stored under `public/uploads`.
- The admin UI and public site share the same design system in `styles.css`.
- Blog taxonomy is managed from the admin panel and persisted in `config/taxonomy.json`.
