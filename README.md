# Automation CRM

Next.js CRM for admin/user task management, lead assignment, lead follow-up, and Google Sheets lead synchronization.

## Requirements

- Node.js 20+
- PostgreSQL database
- Google Apps Script deployment for sheet sync

## Environment

Copy `.env.example` to `.env` and set real values.

Required variables:

- `DATABASE_URL`: PostgreSQL connection string.
- `AUTH_SECRET`: random session signing secret, at least 32 characters.
- `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: used by `npm run seed:admin`.

## Local Setup

```bash
npm install
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm run seed:admin
npm run dev
```

Open `http://localhost:3000`.

## Production Checks

Run these before deployment:

```bash
npm run lint
npm run typecheck
npm run build
```

For production databases, apply migrations with:

```bash
npm run prisma:deploy
```

## Lead Sync

Configure Website and Instagram lead integrations from Admin Settings. Each source needs:

- Apps Script Web App URL ending in `/exec`
- Google Spreadsheet ID
- Sheet tab name
- Shared secret token matching Apps Script `API_KEY`

Public registration is disabled. Admins create users from the Admin Users screen.
