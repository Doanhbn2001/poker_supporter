# poker_supporter

A small web app for our weekend poker group: log each session's buy-ins and cash-outs, then see a leaderboard and history.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma 7 + PostgreSQL · username/password sign-in (bcrypt + signed session cookie via `jose`).

## Getting started

1. Install dependencies (this also generates the Prisma client):
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill it in:
   - `DATABASE_URL`: a Postgres URL. A free [Neon](https://neon.tech) database works, or a local Postgres.
   - `SESSION_SECRET`: run `openssl rand -base64 32`.
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`: the first admin account.
3. Create the tables and the admin account:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
4. Run it:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and sign in as the admin.

## Accounts

There is no public sign-up. The admin adds friends on the **Players** page with a temporary password, and each player can change their password by clicking their name in the top bar.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Generate Prisma client and build |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Create the admin account from `.env` |
| `npm run db:studio` | Browse the database in Prisma Studio |

## Deploying to Vercel

Import the repo in Vercel, add `DATABASE_URL` and `SESSION_SECRET` as environment variables, and run `npm run db:deploy` and `npm run db:seed` once against the production database.

## Data model

- `User`: username, display name, password hash, role (`ADMIN` or `PLAYER`)
- `GameSession`: date, optional location and notes
- `Result`: one player's buy-in and cash-out in one session. Amounts are integer cents, and net profit is `cashOut - buyIn`.
