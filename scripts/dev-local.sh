#!/usr/bin/env bash
# Runs the app locally: starts Postgres in Docker, brings the schema up to date, then the dev server.
# Usage: ./scripts/dev-local.sh [extra next dev args, e.g. -p 3001]
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER=poker-postgres

if [ ! -f .env ]; then
  echo "Missing .env: run 'cp .env.example .env' and fill it in (see docs/local-setup.md)." >&2
  exit 1
fi

# Create the container the first time; afterwards just start it. Data lives in the poker-pgdata volume.
if ! docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Creating Postgres container $CONTAINER..."
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_USER=poker -e POSTGRES_PASSWORD=poker -e POSTGRES_DB=poker \
    -p 5432:5432 -v poker-pgdata:/var/lib/postgresql/data \
    --restart unless-stopped postgres:16-alpine >/dev/null
elif [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
  echo "Starting $CONTAINER..."
  docker start "$CONTAINER" >/dev/null
fi

printf "Waiting for Postgres"
until docker exec "$CONTAINER" pg_isready -U poker -q; do printf "."; sleep 1; done
echo " ready."

[ -d node_modules ] || npm install

# Prisma 7: migrate doesn't regenerate the client, so generate explicitly. Seed skips an existing admin.
npx prisma migrate deploy
npx prisma generate
npm run db:seed

exec npm run dev -- "$@"
