#!/usr/bin/env bash
# Replaces ALL data in the production database with the local database's data (users, games, results,
# fund transactions). Schema is not touched: deploy the code first so Vercel applies the migrations.
#
# Usage: put PROD_DATABASE_URL (the Neon *unpooled* connection string) in .env.prod (gitignored),
# or export it, then run ./scripts/copy-local-to-prod.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# An exported PROD_DATABASE_URL wins over the file.
if [ -z "${PROD_DATABASE_URL:-}" ] && [ -f .env.prod ]; then
  set -a; . ./.env.prod; set +a
fi

: "${PROD_DATABASE_URL:?Put PROD_DATABASE_URL (Neon unpooled connection string) in .env.prod}"
if [[ "$PROD_DATABASE_URL" == *YOUR_PASSWORD* ]]; then
  echo "Fill in the real connection string in .env.prod first." >&2
  exit 1
fi
CONTAINER=poker-postgres
HOST=$(sed -E 's#^[a-z]+://[^@]*@([^/:?]+).*#\1#' <<<"$PROD_DATABASE_URL")

# No -i: an attached stdin could swallow the "yes" typed at the prompt. Only the load step pipes data in.
local_sql() { docker exec "$CONTAINER" psql -U poker -d poker -v ON_ERROR_STOP=1 "$@"; }
prod_sql() { docker exec "$CONTAINER" psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 "$@"; }

MIGRATIONS='select string_agg(migration_name, $$ $$ order by migration_name) from _prisma_migrations where finished_at is not null'
COUNTS='select (select count(*) from "User") as users, (select count(*) from "GameSession") as games,
  (select count(*) from "Result") as results, (select count(*) from "Transaction") as transactions'
# Every wallet (profit + deposits - withdrawals), to compare both sides after the copy.
WALLETS='select string_agg(username || $$=$$ || w, $$ $$ order by username) from (
  select u.username, u."openingBalance"
    + coalesce((select sum(r."cashOut" - r."buyIn") from "Result" r where r."userId" = u.id), 0)
    + coalesce((select sum(case when t.kind = $$DEPOSIT$$ then t.amount else -t.amount end)
                from "Transaction" t where t."userId" = u.id), 0) as w
  from "User" u) x'

echo "Production host: $HOST"
if [ "$(local_sql -Atc "$MIGRATIONS")" != "$(prod_sql -Atc "$MIGRATIONS")" ]; then
  echo "Production migrations differ from local. Push the code and wait for the Vercel build first." >&2
  exit 1
fi
echo "Migrations match."

echo; echo "Local data:"; local_sql -c "$COUNTS"
echo "Production data (will be DELETED):"; prod_sql -c "$COUNTS"

read -r -p "Replace ALL production data with the local data? Type 'yes' to continue: " answer
[ "$answer" = "yes" ] || { echo "Aborted, nothing changed."; exit 1; }

# One transaction: clear production, then load the local rows. Any error rolls everything back.
{
  echo 'TRUNCATE "Transaction", "Result", "GameSession", "User" CASCADE;'
  docker exec "$CONTAINER" pg_dump -U poker -d poker --data-only --exclude-table=_prisma_migrations
} | docker exec -i "$CONTAINER" psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -q

echo; echo "Production data now:"; prod_sql -c "$COUNTS"
if [ "$(local_sql -Atc "$WALLETS")" = "$(prod_sql -Atc "$WALLETS")" ]; then
  echo "✓ Every wallet in production matches local."
else
  echo "✗ Wallets differ between local and production, check before using the app." >&2
  exit 1
fi
