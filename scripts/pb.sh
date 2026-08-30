#!/usr/bin/env bash
# Start PocketBase for local dev, loading .env (if present) so hooks can read
# ORS_API_KEY etc. via $os.getenv. .env is gitignored; see .env.example.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

exec ./bin/pocketbase serve \
  --dir=pb_data \
  --hooksDir=pb_hooks \
  --migrationsDir=pb_migrations \
  "$@"
