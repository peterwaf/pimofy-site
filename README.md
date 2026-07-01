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

## Notes

- Static uploads are stored under `public/uploads`.
- The admin UI and public site share the same design system in `styles.css`.
- Blog taxonomy is managed from the admin panel and persisted in `config/taxonomy.json`.
