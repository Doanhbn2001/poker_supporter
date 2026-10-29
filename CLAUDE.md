# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A small web app for a weekend poker group: log each session's buy-ins/cash-outs, show a leaderboard, session history, player profiles and profit charts. Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma 7 + PostgreSQL · recharts · zod. The production branch is `BMI` (Vercel).

Next 16 and Prisma 7 both differ from older versions — e.g. middleware is `src/proxy.ts` (default-exported `proxy`), and the Prisma client is generated into the repo (see below). Check `node_modules/next/dist/docs/` before relying on remembered APIs.

## Commands

```bash
npm install          # also runs `prisma generate` (postinstall)
npm run dev          # dev server on http://localhost:3000
npm run build        # prisma generate && next build
npm run lint         # eslint
npm run db:migrate   # prisma migrate dev (create/apply migrations)
npm run db:deploy    # prisma migrate deploy (production)
npm run db:seed      # create admin account from ADMIN_USERNAME/ADMIN_PASSWORD
npm run db:studio
```

There is no test runner configured. Type-check with `npx tsc --noEmit`.

Env (`.env`, see `.env.example`): `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`. `prisma.config.ts` prefers `DATABASE_URL_UNPOOLED` for migrations (Neon on Vercel); the runtime client uses `DATABASE_URL`. Vercel runs `npm run vercel-build` (generate → migrate deploy → seed → build).

## Architecture

- **Prisma client is generated to `src/generated/prisma`** (gitignored) via the `prisma-client` generator. Import from `@/generated/prisma/client` / `@/generated/prisma/enums`, not `@prisma/client`. It uses the `@prisma/adapter-pg` driver adapter; the singleton lives in `src/lib/prisma.ts`. After editing `prisma/schema.prisma`, run `npm run db:migrate` **then `npx prisma generate`** — in Prisma 7 `migrate dev` no longer regenerates the client. Restart `next dev` afterwards: the dev server caches the old client on `globalThis`.
- **Spreadsheet history import:** `npm run db:import` (`prisma/import-history.ts`) loads `prisma/data/history.json` (converted from `poker.xlsx`; both gitignored as real data). Dry run by default, `-- --apply` to write; aborts if any session exists. New players get the shared default password `12345678` (the group chose convenience over security; players can change it on `/account`). The sheet only records net per player, so losses are stored as `buyIn` and wins as `cashOut`.
- **Crowns are derived:** total = `User.crowns` (imported titles) + count of sessions where `GameSession.championId` is that user (`_count: { championships }`). Never increment `User.crowns` when logging a session; editing/deleting a session then stays consistent on its own.
- **Session form** doesn't edit `location` (omitted so updates keep imported values). `notes` holds the cup name: the form pre-fills "Cup N" numbered per day (`getCupsByDate`), and an empty name is filled the same way server-side (`withCupName`).
- **Opening balance:** `User.openingBalance` (cents) is profit carried over from before tracking started. It is added to a player's net, leaderboard rank and the start of their running-total/chart lines, but is **not** a session — session count, win rate, avg/session (`PlayerStats.sessionNet / sessions`), best/worst, streak and last-5 use sessions only.
- **Auth is two-layered.** `src/lib/session.ts` signs/verifies an HS256 JWT cookie named `session` with `jose`. `src/proxy.ts` does only an optimistic cookie check to redirect to/from `/login`. The real authorization is the DAL in `src/lib/dal.ts`: `requireUser()` (React-`cache`d, re-checks the user exists in the DB) and `requireAdmin()`. Every page and every server action must call one of these — never trust the proxy alone.
- **Permissions:** no public sign-up. Only `ADMIN` can create players (`src/app/actions/players.ts`) and log, edit or delete sessions (`requireAdmin` in `src/app/actions/sessions.ts` and the `/sessions/new` and `/sessions/[id]/edit` pages); the "+ Log session" / Edit / Delete controls are hidden for players. Any signed-in user can edit their own poker name, motto and password on `/account`.
- **Mutations are server actions** in `src/app/actions/*` (`"use server"`), consumed by client form components via `useActionState`-style `(prevState, formData)` signatures returning `{ error?: string }`. They validate input, write via Prisma, then `revalidatePath`/`redirect`. Session forms submit parallel `playerId`/`buyIn`/`cashOut` field arrays.
- **Reads happen in server components** under `src/app/(app)/` (the authed route group whose `layout.tsx` renders the top bar). Aggregation/stat queries live in `src/lib/stats.ts` (server-only): leaderboard, session summaries, running-profit series for charts. Client components are limited to forms, the delete button, and the recharts charts in `src/components/charts/`.
- **Money is integer cents** everywhere in the DB (`Result.buyIn`, `Result.cashOut`); net = `cashOut - buyIn`. Convert input with `toCents()` and display with `formatMoney()` (`src/lib/money.ts`).
- **Dates:** `GameSession.playedAt` is a `@db.Date` stored as UTC midnight (`new Date("YYYY-MM-DDT00:00:00Z")`); always format with `formatDate()` in `src/lib/dates.ts` (UTC) to avoid off-by-one days.
- Shared UI primitives (`Card`, `Button`, …) are in `src/components/ui.tsx` — plain Tailwind classes with `dark:` variants.
- **Theme:** `dark:` is driven by `<html data-theme>` (custom variant in `globals.css`), not `prefers-color-scheme`. Default is dark; an inline script in `app/layout.tsx` applies the `localStorage.theme` choice before paint, and `ThemeToggle` flips it. Theme-dependent CSS variables go under `[data-theme="dark"]`. Path alias `@/*` → `src/*`.
